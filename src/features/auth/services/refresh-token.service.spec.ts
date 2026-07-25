import { ClockService } from '@core/clock/clock.service';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import { createHash } from 'crypto';
import { RefreshTokenService } from './refresh-token.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const NOW_MS = 1710000000000;
const EXPIRES_AT = new Date(NOW_MS + 1000);

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;

  const mockTokenService = {
    verifyRefreshToken: jest.fn(),
    issuePair: jest.fn()
  };

  const mockRedisLockService = {
    acquire: jest.fn(),
    release: jest.fn()
  };

  const mockSessionRepository = {
    findActiveSession: jest.fn(),
    rotateRefreshToken: jest.fn()
  };

  const mockRefreshTokenHasher = {
    compare: jest.fn(),
    hash: jest.fn()
  };

  const mockClockService = {
    snapshot: jest.fn()
  };

  const mockRevokeSessionService = {
    revokeSession: jest.fn()
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

    service = new RefreshTokenService(
      mockTokenService as any,
      mockRedisLockService as any,
      mockSessionRepository as any,
      mockRefreshTokenHasher as any,
      mockClockService as unknown as ClockService,
      mockRevokeSessionService as any,
      mockLogger as any
    );
  });

  describe('refreshTokens', () => {
    it('should refresh successfully', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockSessionRepository.findActiveSession.mockResolvedValue({
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

      mockSessionRepository.rotateRefreshToken.mockResolvedValue(true);

      const result = await service.refreshTokens('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });

      expect(mockSessionRepository.rotateRefreshToken).toHaveBeenCalledWith(
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

      mockSessionRepository.findActiveSession.mockResolvedValue(null);

      await expect(service.refreshTokens('token')).rejects.toEqual(
        SessionErrors.sessionExpired()
      );
    });

    it('should throw refreshRateLimited', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue(null);

      await expect(service.refreshTokens('token')).rejects.toEqual(
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

      mockSessionRepository.findActiveSession.mockResolvedValue(session);

      await expect(service.refreshTokens('token')).rejects.toEqual(
        SessionErrors.sessionReuseDetected('session-id')
      );

      expect(mockRevokeSessionService.revokeSession).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
    });

    it('should throw when rotateRefreshToken fails', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockSessionRepository.findActiveSession.mockResolvedValue({
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

      mockSessionRepository.rotateRefreshToken.mockResolvedValue(false);

      await expect(service.refreshTokens('token')).rejects.toEqual(
        SessionErrors.sessionReuseDetected('session-id')
      );
    });
  });
});
