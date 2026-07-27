import { ClockService } from '@core/clock/clock.service';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import { createHash } from 'crypto';
import { Refresh } from '../refresh.use-case';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const NOW_MS = 1710000000000;
const EXPIRES_AT = new Date(NOW_MS + 1000);

describe('Refresh', () => {
  let service: Refresh;

  const mockTokenService = {
    verifyRefreshToken: jest.fn(),
    issuePair: jest.fn()
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

  const mockRevocationService = {
    revoke: jest.fn()
  };

  const mockSessionRotationService = {
    rotate: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockClockService.snapshot.mockReturnValue({
      now: NOW_MS,
      expiresAt: EXPIRES_AT
    });

    mockRedisLockService.release.mockResolvedValue(undefined);

    mockRefreshTokenHasher.hash.mockImplementation((t: string) => sha256(t));
    mockRefreshTokenHasher.compare.mockImplementation(
      (token: string, hash: string) => sha256(token) === hash
    );

    service = new Refresh(
      mockTokenService as any,
      mockRedisLockService as any,
      mockSessionQueryService as any,
      mockRefreshTokenHasher as any,
      mockClockService as unknown as ClockService,
      mockRevocationService as any,
      mockSessionRotationService as any,
      mockLogger as any
    );
  });

  describe('refresh', () => {
    it('should refresh successfully', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({
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

      mockTokenService.issuePair.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });

      mockSessionRotationService.rotate.mockResolvedValue(true);

      const result = await service.refresh('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });

      expect(mockSessionRotationService.rotate).toHaveBeenCalledWith(
        'session-id',
        undefined,
        sha256('refresh-token'),
        sha256('new-refresh'),
        expect.anything()
      );
    });

    it('should throw sessionExpired', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({
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
      mockTokenService.verifyRefreshToken.mockResolvedValue({
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

      mockTokenService.verifyRefreshToken.mockResolvedValue({
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

      expect(mockRevocationService.revoke).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
    });

    it('should throw when rotate fails', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({
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

      mockTokenService.issuePair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh'
      });

      mockSessionRotationService.rotate.mockResolvedValue(false);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.sessionReuseDetected('session-id')
      );
    });
  });
});
