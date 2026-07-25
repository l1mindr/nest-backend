import { ClockService } from '@core/clock/clock.service';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import {
  ISSUE_SESSION_SERVICE,
  REVOKE_SESSION_SERVICE,
  SESSION_REPOSITORY,
  TERMINATE_OTHER_SESSIONS_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import { TokenErrors } from '@features/token/errors/token-errors';
import { TOKEN_SERVICE } from '@features/token/interfaces/token.interface';
import { USER_SERVICE } from '@features/users/interfaces/users.interface';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, EntityManager } from 'typeorm';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { AuthService } from './auth.service';
import { AuthErrors } from './errors/auth-errors';
import { HashingProvider } from './providers/hashing.provider';
import { RefreshTokenHasher } from './providers/refresh-token-hasher.provider';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const NOW_MS = 1710000000000;
const EXPIRES_AT = new Date(NOW_MS + 1000);

describe('AuthService', () => {
  let service: AuthService;

  const mockDeviceMapper = {
    toSessionUserAgent: jest.fn()
  };

  const mockClockService = {
    snapshot: jest.fn()
  };

  const mockHashingProvider = {
    hash: jest.fn(),
    compare: jest.fn()
  };

  const mockIssueSessionService = {
    issue: jest.fn()
  };

  const mockRevokeSessionService = {
    revoke: jest.fn()
  };

  const mockTerminateOtherSessionsService = {
    terminateOthers: jest.fn()
  };

  const mockSessionRepository = {
    getActive: jest.fn(),
    rotateAtomic: jest.fn()
  };

  const mockUsersService = {
    register: jest.fn(),
    findByIdentifierForAuth: jest.fn(),
    findByIdWithPassword: jest.fn(),
    setPassword: jest.fn()
  };

  const mockTokenService = {
    issuePair: jest.fn(),
    verifyRefreshToken: jest.fn()
  };

  const mockRedisLockService = {
    acquire: jest.fn(),
    release: jest.fn()
  };

  const mockTransactionManager = {} as EntityManager;

  const mockDataSource = {
    transaction: jest.fn(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(mockTransactionManager)
    ),
    getRepository: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DeviceMapper,
          useValue: mockDeviceMapper
        },
        {
          provide: ClockService,
          useValue: mockClockService
        },
        {
          provide: HashingProvider,
          useValue: mockHashingProvider
        },
        RefreshTokenHasher,
        {
          provide: ISSUE_SESSION_SERVICE,
          useValue: mockIssueSessionService
        },
        {
          provide: REVOKE_SESSION_SERVICE,
          useValue: mockRevokeSessionService
        },
        {
          provide: TERMINATE_OTHER_SESSIONS_SERVICE,
          useValue: mockTerminateOtherSessionsService
        },
        {
          provide: SESSION_REPOSITORY,
          useValue: mockSessionRepository
        },
        {
          provide: USER_SERVICE,
          useValue: mockUsersService
        },
        {
          provide: TOKEN_SERVICE,
          useValue: mockTokenService
        },
        {
          provide: RedisLockService,
          useValue: mockRedisLockService
        },
        {
          provide: DataSource,
          useValue: mockDataSource
        },
        {
          provide: PinoLogger,
          useValue: mockLogger
        }
      ]
    }).compile();

    service = module.get(AuthService);
  });

  describe('registerUser', () => {
    it('should hash password and register user', async () => {
      mockHashingProvider.hash.mockResolvedValue('hashed-password');

      await service.registerUser({
        email: 'test@test.com',
        password: '123456'
      } as any);

      expect(mockHashingProvider.hash).toHaveBeenCalledWith('123456');

      expect(mockUsersService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashed-password'
        })
      );
    });
  });

  describe('loginUser', () => {
    it('should login successfully', async () => {
      mockUsersService.findByIdentifierForAuth.mockResolvedValue({
        id: 'user-id',
        password: 'hashed-password',
        status: UserStatus.ACTIVATE
      });

      mockHashingProvider.compare.mockResolvedValue(true);

      mockClockService.snapshot.mockReturnValue({
        now: NOW_MS,
        expiresAt: EXPIRES_AT
      });

      mockDeviceMapper.toSessionUserAgent.mockReturnValue({
        browserName: 'Chrome',
        browserVersion: '120.0.0.0',
        osName: 'Windows',
        deviceType: 'desktop'
      });

      mockIssueSessionService.issue.mockResolvedValue({
        id: 'session-id'
      });

      mockTokenService.issuePair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      const mockSessionRepo = {
        save: jest.fn()
      };
      mockDataSource.getRepository.mockReturnValue(mockSessionRepo);

      const result = await service.loginUser(
        {
          email: 'test@test.com',
          password: '123456'
        },
        '127.0.0.1',
        {} as any
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });
      expect(mockSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session-id',
          refreshTokenHash: sha256('refresh-token')
        })
      );
    });

    it('should throw when user not found', async () => {
      mockUsersService.findByIdentifierForAuth.mockResolvedValue(null);

      await expect(
        service.loginUser(
          {
            email: 'test@test.com',
            password: '123456'
          },
          '127.0.0.1',
          {} as any
        )
      ).rejects.toEqual(AuthErrors.invalidCredentials());
    });

    it('should throw when password mismatch', async () => {
      mockUsersService.findByIdentifierForAuth.mockResolvedValue({
        id: 'user-id',
        password: 'hash'
      });

      mockHashingProvider.compare.mockResolvedValue(false);

      await expect(
        service.loginUser(
          {
            email: 'test@test.com',
            password: '123456'
          },
          '127.0.0.1',
          {} as any
        )
      ).rejects.toEqual(AuthErrors.invalidCredentials());
    });

    it.each([UserStatus.DEACTIVATE, UserStatus.SUSPEND])(
      'should reject login for %s users with invalidCredentials and issue no tokens',
      async (status) => {
        mockUsersService.findByIdentifierForAuth.mockResolvedValue({
          id: 'user-id',
          password: 'hashed-password',
          status
        });

        mockHashingProvider.compare.mockResolvedValue(true);

        await expect(
          service.loginUser(
            {
              email: 'test@test.com',
              password: '123456'
            },
            '127.0.0.1',
            {} as any
          )
        ).rejects.toEqual(AuthErrors.invalidCredentials());

        expect(mockIssueSessionService.issue).not.toHaveBeenCalled();
        expect(mockTokenService.issuePair).not.toHaveBeenCalled();
      }
    );
  });

  describe('changeUserPassword', () => {
    it('should change password successfully', async () => {
      mockUsersService.findByIdWithPassword.mockResolvedValue({
        id: 'user-id',
        password: 'old-hash'
      });

      mockHashingProvider.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      mockHashingProvider.hash.mockResolvedValue('new-hash');

      await service.changeUserPassword('user-id', 'session-id', {
        currentPassword: 'old-password',
        newPassword: 'new-password'
      });

      expect(mockUsersService.setPassword).toHaveBeenCalledWith(
        'user-id',
        'new-hash',
        mockTransactionManager
      );

      expect(
        mockTerminateOtherSessionsService.terminateOthers
      ).toHaveBeenCalledWith('user-id', 'session-id', mockTransactionManager);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('should fail the transaction when session revocation fails', async () => {
      const error = new Error('session update failed');

      mockUsersService.findByIdWithPassword.mockResolvedValue({
        id: 'user-id',
        password: 'old-hash'
      });
      mockHashingProvider.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockHashingProvider.hash.mockResolvedValue('new-hash');
      mockTerminateOtherSessionsService.terminateOthers.mockRejectedValueOnce(
        error
      );

      await expect(
        service.changeUserPassword('user-id', 'session-id', {
          currentPassword: 'old-password',
          newPassword: 'new-password'
        })
      ).rejects.toEqual(AuthErrors.passwordChangeFailed());

      expect(mockUsersService.setPassword).toHaveBeenCalledWith(
        'user-id',
        'new-hash',
        mockTransactionManager
      );
      expect(
        mockTerminateOtherSessionsService.terminateOthers
      ).toHaveBeenCalledWith('user-id', 'session-id', mockTransactionManager);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'password.changed' }),
        expect.any(String)
      );
    });

    it('should throw when user not found', async () => {
      mockUsersService.findByIdWithPassword.mockResolvedValue(null);

      await expect(
        service.changeUserPassword('user-id', 'session-id', {
          currentPassword: 'old',
          newPassword: 'new'
        })
      ).rejects.toEqual(TokenErrors.invalidToken());
    });

    it('should throw invalidCurrentPassword', async () => {
      mockUsersService.findByIdWithPassword.mockResolvedValue({
        password: 'hash'
      });

      mockHashingProvider.compare.mockResolvedValue(false);

      await expect(
        service.changeUserPassword('user-id', 'session-id', {
          currentPassword: 'wrong',
          newPassword: 'new'
        })
      ).rejects.toEqual(AuthErrors.invalidCurrentPassword());
    });

    it('should throw passwordMustBeDifferent', async () => {
      mockUsersService.findByIdWithPassword.mockResolvedValue({
        password: 'hash'
      });

      mockHashingProvider.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        service.changeUserPassword('user-id', 'session-id', {
          currentPassword: 'old',
          newPassword: 'old'
        })
      ).rejects.toEqual(AuthErrors.passwordMustBeDifferent());
    });
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

      mockRedisLockService.release.mockResolvedValue(undefined);

      mockSessionRepository.getActive.mockResolvedValue({
        id: 'session-id',
        refreshTokenHash: sha256('refresh-token'),
        owner: {
          id: 'user-id'
        }
      });

      mockClockService.snapshot.mockReturnValue({
        now: NOW_MS,
        expiresAt: EXPIRES_AT
      });

      mockTokenService.issuePair.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });

      mockSessionRepository.rotateAtomic.mockResolvedValue(true);

      const result = await service.refresh('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });

      // The rotated hash stored must be the SHA-256 digest of the new token.
      expect(mockSessionRepository.rotateAtomic).toHaveBeenCalledWith(
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

      mockRedisLockService.release.mockResolvedValue(undefined);

      mockSessionRepository.getActive.mockResolvedValue(null);

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

      mockRedisLockService.release.mockResolvedValue(undefined);

      mockSessionRepository.getActive.mockResolvedValue(session);

      mockClockService.snapshot.mockReturnValue({
        now: NOW_MS,
        expiresAt: EXPIRES_AT
      });

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.sessionReuseDetected('session-id')
      );

      expect(mockRevokeSessionService.revoke).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
    });

    it('should throw when rotateAtomic fails', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockRedisLockService.acquire.mockResolvedValue({
        key: 'lock-key',
        token: 'lock-token'
      });

      mockRedisLockService.release.mockResolvedValue(undefined);

      mockSessionRepository.getActive.mockResolvedValue({
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

      mockSessionRepository.rotateAtomic.mockResolvedValue(false);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.sessionReuseDetected('session-id')
      );
    });
  });
});
