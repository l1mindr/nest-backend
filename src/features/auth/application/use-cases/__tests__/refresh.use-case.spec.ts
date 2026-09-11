import { ClockService } from '@infrastructure/clock/clock.service';
import { SessionErrors } from '@features/sessions/domain/errors/session-errors';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { createHash } from 'crypto';
import { Refresh } from '../../use-cases/refresh.use-case';
import {
  REFRESH_REPLAY_GRACE_SECONDS,
  RefreshReplayService
} from '../../services/refresh-replay.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const NOW_MS = 1710000000000;
const EXPIRES_AT = new Date(NOW_MS + 1000);

/**
 * Redis double with real TTL semantics driven by an explicit clock, so the
 * grace window can be stepped over without sleeping. Only the two commands
 * `RefreshReplayService` issues are implemented.
 */
class FakeRedisService {
  private readonly store = new Map<
    string,
    { value: string; expiresAtMs: number }
  >();

  constructor(private readonly nowMs: () => number) {}

  async setWithExpiry(key: string, value: string, ttlSeconds: number) {
    this.store.set(key, {
      value: String(value),
      expiresAtMs: this.nowMs() + ttlSeconds * 1000
    });

    return 'OK' as const;
  }

  async get(key: string) {
    const entry = this.store.get(key);

    if (!entry) return null;

    if (this.nowMs() >= entry.expiresAtMs) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }
}

describe('Refresh', () => {
  let service: Refresh;

  const mockTokenVerificationService = {
    verifyRefresh: jest.fn()
  };

  const mockRedisLockService = {
    acquire: jest.fn(),
    release: jest.fn()
  };

  const mockSessionQueryService = {
    findActive: jest.fn()
  };

  const mockRefreshTokenHasher = {
    compare: jest.fn(),
    hash: jest.fn()
  };

  const mockClockService = {
    snapshot: jest.fn()
  };

  const mockRevocationUseCase = {
    revoke: jest.fn()
  };

  const mockSessionRotationUseCase = {
    execute: jest.fn()
  };

  const mockTokenIssueService = {
    issuePair: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  /** Drives both the fake Redis TTL and `snapshot()`, so time is explicit. */
  let currentMs: number;
  let replayService: RefreshReplayService;

  beforeEach(() => {
    jest.clearAllMocks();

    currentMs = NOW_MS;

    mockClockService.snapshot.mockImplementation(() => ({
      now: currentMs,
      expiresAt: EXPIRES_AT
    }));

    mockRedisLockService.release.mockResolvedValue(undefined);

    mockRefreshTokenHasher.hash.mockImplementation((t: string) => sha256(t));
    mockRefreshTokenHasher.compare.mockImplementation(
      (token: string, hash: string) => sha256(token) === hash
    );

    replayService = new RefreshReplayService(
      new FakeRedisService(() => currentMs) as never
    );

    service = new Refresh(
      mockTokenVerificationService as any,
      mockRedisLockService as any,
      mockSessionQueryService as any,
      mockRefreshTokenHasher as any,
      mockClockService as unknown as ClockService,
      mockRevocationUseCase as any,
      mockSessionRotationUseCase as any,
      mockTokenIssueService as any,
      replayService,
      mockLogger as any
    );
  });

  describe('refresh', () => {
    it('should refresh successfully', async () => {
      mockTokenVerificationService.verifyRefresh.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockSessionQueryService.findActive.mockResolvedValue({
        id: 'session-id',
        refreshTokenHash: sha256('refresh-token'),
        owner: {
          id: 'user-id'
        }
      });

      mockTokenIssueService.issuePair.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });

      mockSessionRotationUseCase.execute.mockResolvedValue(true);

      const result = await service.refresh('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });

      expect(mockSessionRotationUseCase.execute).toHaveBeenCalledWith(
        'session-id',
        undefined,
        sha256('refresh-token'),
        sha256('new-refresh'),
        expect.anything()
      );
    });

    it('should throw sessionExpired', async () => {
      mockTokenVerificationService.verifyRefresh.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockSessionQueryService.findActive.mockResolvedValue(null);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.sessionExpired()
      );
    });

    it('should throw refreshRateLimited', async () => {
      mockTokenVerificationService.verifyRefresh.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue(null);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.refreshRateLimited('session-id')
      );
    });

    it('should revoke session on token reuse', async () => {
      const session = {
        id: 'session-id',
        refreshTokenHash: sha256('a-different-token'),
        owner: {
          id: 'user-id'
        }
      };

      mockTokenVerificationService.verifyRefresh.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockSessionQueryService.findActive.mockResolvedValue(session);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.sessionReuseDetected('session-id')
      );

      expect(mockRevocationUseCase.revoke).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
    });

    /**
     * `affected = 0` on the optimistic update. The presented token matched the
     * stored hash — it *was* the current token — so this is a lost race, not a
     * replay, and it must not reach for the reuse machinery.
     */
    it('should raise a retryable rotation conflict when the optimistic write loses', async () => {
      mockTokenVerificationService.verifyRefresh.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockSessionQueryService.findActive.mockResolvedValue({
        id: 'session-id',
        refreshTokenHash: sha256('token'),
        owner: {
          id: 'user-id'
        }
      });

      mockClockService.snapshot.mockReturnValue({
        now: NOW_MS,
        expiresAt: EXPIRES_AT
      });

      mockTokenIssueService.issuePair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh'
      });

      mockSessionRotationUseCase.execute.mockResolvedValue(false);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.refreshRotationConflict('session-id')
      );
    });

    it('should not revoke the session when the optimistic write loses', async () => {
      mockTokenVerificationService.verifyRefresh.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockSessionQueryService.findActive.mockResolvedValue({
        id: 'session-id',
        refreshTokenHash: sha256('token'),
        owner: { id: 'user-id' }
      });

      mockTokenIssueService.issuePair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh'
      });

      mockSessionRotationUseCase.execute.mockResolvedValue(false);

      await expect(service.refresh('token')).rejects.toMatchObject({
        code: 'REFRESH_ROTATION_CONFLICT',
        statusCode: 409
      });

      expect(mockRevocationUseCase.revoke).not.toHaveBeenCalled();
    });

    /**
     * `auth.refresh.reuse_detected` is emitted by `GlobalExceptionFilter` off
     * the error *code*, so the assertion that matters here is that the code
     * this path throws is not the one that triggers it. The filter's own spec
     * covers the other half.
     */
    it('should log the optimistic write loss as a rotation conflict, not as reuse', async () => {
      mockTokenVerificationService.verifyRefresh.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockSessionQueryService.findActive.mockResolvedValue({
        id: 'session-id',
        refreshTokenHash: sha256('token'),
        owner: { id: 'user-id' }
      });

      mockTokenIssueService.issuePair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh'
      });

      mockSessionRotationUseCase.execute.mockResolvedValue(false);

      await expect(service.refresh('token')).rejects.toMatchObject({
        code: 'REFRESH_ROTATION_CONFLICT'
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.REFRESH_ROTATION_CONFLICT,
          sessionId: 'session-id'
        }),
        expect.any(String)
      );

      const emitted = [
        ...mockLogger.info.mock.calls,
        ...mockLogger.warn.mock.calls,
        ...mockLogger.error.mock.calls
      ].map(([payload]) => (payload as { event?: string }).event);

      expect(emitted).not.toContain(LogEvent.REFRESH_REUSE_DETECTED);
    });
  });

  /**
   * The rotation grace window. These drive a stateful session double rather
   * than fixed mock returns, because every case here turns on how `version`
   * and `refreshTokenHash` advance across successive rotations — the two
   * things that decide whether a presented token is the immediately previous
   * generation or an older one replaying.
   */
  describe('rotation race grace window', () => {
    const USER_ID = 'user-id';
    const SESSION_ID = 'session-id';

    /** Live session row the query service and rotation use case share. */
    let session: { id: string; version: number; refreshTokenHash: string };
    let issued: number;

    /** Installs a session whose current refresh token is `initialToken`. */
    function seedSession(initialToken: string, sessionId = SESSION_ID) {
      session = {
        id: sessionId,
        version: 0,
        refreshTokenHash: sha256(initialToken)
      };
      issued = 0;

      mockTokenVerificationService.verifyRefresh.mockImplementation(
        async (token: string) => ({
          sub: USER_ID,
          // Session binding travels in the token itself, exactly as the real
          // JWT claim does.
          sessionId: token.startsWith('other-') ? 'other-session' : sessionId
        })
      );

      mockRedisLockService.acquire.mockResolvedValue('lock-token');

      mockSessionQueryService.findActive.mockImplementation(
        async (_sub: string, id: string) =>
          id === session.id ? { ...session, owner: { id: USER_ID } } : null
      );

      mockTokenIssueService.issuePair.mockImplementation(async () => {
        issued += 1;
        return {
          accessToken: `access-${issued}`,
          refreshToken: `refresh-${issued}`
        };
      });

      // Mirrors the repository's optimistic update: succeeds only when both
      // the expected version and the expected old hash still hold.
      mockSessionRotationUseCase.execute.mockImplementation(
        async (
          _sessionId: string,
          version: number,
          oldHash: string,
          newHash: string
        ) => {
          if (session.version !== version) return false;
          if (session.refreshTokenHash !== oldHash) return false;

          session.version += 1;
          session.refreshTokenHash = newHash;

          return true;
        }
      );
    }

    it('rotates normally and advances the session generation', async () => {
      seedSession('R1');

      const result = await service.refresh('R1');

      expect(result.refreshToken).toBe('refresh-1');
      expect(session.version).toBe(1);
      expect(session.refreshTokenHash).toBe(sha256('refresh-1'));
      expect(mockRevocationUseCase.revoke).not.toHaveBeenCalled();
    });

    it('serves a near-simultaneous refresh the winner’s exact pair without a second rotation', async () => {
      seedSession('R1');

      const winner = await service.refresh('R1');

      // The racing request left before the winner's Set-Cookie landed, so it
      // still carries R1.
      const racer = await service.refresh('R1');

      expect(racer).toEqual(winner);
      // One logical rotation: the loser did not mint a second lineage.
      expect(issued).toBe(1);
      expect(session.version).toBe(1);
      expect(mockRevocationUseCase.revoke).not.toHaveBeenCalled();
    });

    it('detects reuse once the grace window has expired', async () => {
      seedSession('R1');

      await service.refresh('R1');

      currentMs += REFRESH_REPLAY_GRACE_SECONDS * 1000 + 1;

      await expect(service.refresh('R1')).rejects.toEqual(
        SessionErrors.sessionReuseDetected(SESSION_ID)
      );

      expect(mockRevocationUseCase.revoke).toHaveBeenCalledWith(
        USER_ID,
        SESSION_ID
      );
    });

    it('refuses a token two generations back even inside the window', async () => {
      seedSession('R1');

      await service.refresh('R1'); // R1 -> refresh-1
      await service.refresh('refresh-1'); // refresh-1 -> refresh-2

      expect(session.version).toBe(2);

      // R1's record is still within its TTL, but the session has moved on by
      // two rotations, so it must not resolve.
      await expect(service.refresh('R1')).rejects.toEqual(
        SessionErrors.sessionReuseDetected(SESSION_ID)
      );

      expect(mockRevocationUseCase.revoke).toHaveBeenCalledWith(
        USER_ID,
        SESSION_ID
      );
    });

    it('never resolves a refresh for a different session', async () => {
      seedSession('R1');

      await service.refresh('R1');

      // Carries a different sessionId claim; its session does not exist, so
      // the lookup can never reach the record written above.
      await expect(service.refresh('other-R1')).rejects.toEqual(
        SessionErrors.sessionExpired()
      );
    });

    /**
     * The lock-expiry case, made deterministic.
     *
     * `REFRESH_LOCK` lives five seconds; a request still in flight when it
     * lapses no longer excludes anyone, so a second refresh can acquire the
     * lock and commit between this one's read and its compare-and-swap write.
     * `issuePair` runs in exactly that gap, so committing the winner's rotation
     * from there reproduces the interleaving precisely — no timers, no sleeps,
     * no flakiness.
     */
    function rotateFromUnderneath(winnerToken: string) {
      mockTokenIssueService.issuePair.mockImplementationOnce(async () => {
        session.version += 1;
        session.refreshTokenHash = sha256(winnerToken);

        return { accessToken: 'access-loser', refreshToken: 'refresh-loser' };
      });
    }

    it('answers a lost compare-and-swap with a retryable conflict, leaving the session alone', async () => {
      seedSession('R1');
      rotateFromUnderneath('winner-refresh');

      await expect(service.refresh('R1')).rejects.toEqual(
        SessionErrors.refreshRotationConflict(SESSION_ID)
      );

      // Not reuse: no revocation, and the winner's rotation is the only one
      // that landed — the loser did not mint a second lineage.
      expect(mockRevocationUseCase.revoke).not.toHaveBeenCalled();
      expect(session.version).toBe(1);
      expect(session.refreshTokenHash).toBe(sha256('winner-refresh'));
    });

    it('lets a bounded retry succeed once the winner’s token is in hand', async () => {
      seedSession('R1');
      rotateFromUnderneath('winner-refresh');

      await expect(service.refresh('R1')).rejects.toEqual(
        SessionErrors.refreshRotationConflict(SESSION_ID)
      );

      // What the client does next: retry with the cookie the winner set. The
      // session is still active, so this is an ordinary rotation.
      const retry = await service.refresh('winner-refresh');

      expect(retry.refreshToken).toBe('refresh-1');
      expect(session.version).toBe(2);
      expect(mockRevocationUseCase.revoke).not.toHaveBeenCalled();
    });

    it('keeps one session authenticated through a concurrent refresh storm', async () => {
      seedSession('R1');

      // The Redis lock serializes these against one another; what is under
      // test is that every loser resolves from the grace record rather than
      // tripping revocation.
      const results = [];

      for (let i = 0; i < 5; i += 1) {
        results.push(await service.refresh('R1'));
      }

      expect(results.every((r) => r.refreshToken === 'refresh-1')).toBe(true);
      expect(issued).toBe(1);
      expect(session.version).toBe(1);
      expect(mockRevocationUseCase.revoke).not.toHaveBeenCalled();
    });
  });
});
