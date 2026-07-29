import { ClockService } from '@infrastructure/services/clock.service';
import { SessionErrors } from '@features/sessions/domain/errors/session-errors';
import { createHash } from 'crypto';
import { Refresh } from '../../use-cases/refresh.use-case';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const NOW_MS = 1710000000000;
const EXPIRES_AT = new Date(NOW_MS + 1000);

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
      mockTokenVerificationService as any,
      mockRedisLockService as any,
      mockSessionQueryService as any,
      mockRefreshTokenHasher as any,
      mockClockService as unknown as ClockService,
      mockRevocationUseCase as any,
      mockSessionRotationUseCase as any,
      mockTokenIssueService as any,
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

    it('should throw when rotate fails', async () => {
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
        SessionErrors.sessionReuseDetected('session-id')
      );
    });
  });
});
