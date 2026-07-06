import { ClockService } from '@core/clock/clock.service';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import { SessionsService } from '@features/sessions/sessions.service';
import { TokenErrors } from '@features/token/errors/token-errors';
import { TokenService } from '@features/token/token.service';
import { UsersService } from '@features/users/users.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthErrors } from './errors/auth-errors';
import { HashingProvider } from './providers/hashing.provider';

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

  const mockSessionsService = {
    issue: jest.fn(),
    getActive: jest.fn(),
    updateRefreshState: jest.fn(),
    terminateOthers: jest.fn(),
    revoke: jest.fn(),
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
        {
          provide: SessionsService,
          useValue: mockSessionsService
        },
        {
          provide: UsersService,
          useValue: mockUsersService
        },
        {
          provide: TokenService,
          useValue: mockTokenService
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
      const now = Date.now();
      const expiresAt = new Date(now + 1000);

      mockUsersService.findByIdentifierForAuth.mockResolvedValue({
        id: 'user-id',
        password: 'hashed-password'
      });

      mockHashingProvider.compare.mockResolvedValue(true);

      mockClockService.snapshot.mockReturnValue({
        now,
        expiresAt
      });

      mockDeviceMapper.toSessionUserAgent.mockReturnValue({
        browser: 'Chrome'
      });

      mockSessionsService.issue.mockResolvedValue({
        id: 'session-id'
      });

      mockTokenService.issuePair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      mockHashingProvider.hash.mockResolvedValue('refresh-token-hash');

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
        'new-hash'
      );

      expect(mockSessionsService.terminateOthers).toHaveBeenCalledWith(
        'user-id',
        'session-id'
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
      const now = Date.now();
      const expiresAt = new Date(now + 1000);

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockSessionsService.getActive.mockResolvedValue({
        id: 'session-id',
        refreshTokenHash: 'old-hash',
        owner: {
          id: 'user-id'
        }
      });

      mockClockService.snapshot.mockReturnValue({
        now,
        expiresAt
      });

      mockHashingProvider.compare.mockResolvedValue(true);

      mockTokenService.issuePair.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });

      mockHashingProvider.hash.mockResolvedValue('new-refresh-hash');

      mockSessionsService.rotateAtomic.mockResolvedValue(true);

      const result = await service.refresh('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh'
      });
    });

    it('should throw sessionExpired', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockSessionsService.getActive.mockResolvedValue(null);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.sessionExpired()
      );
    });

    // it('should throw refreshRateLimited', async () => {
    //   const now = Date.now();

    //   mockTokenService.verifyRefreshToken.mockResolvedValue({
    //     sub: 'user-id',
    //     sessionId: 'session-id'
    //   });

    //   mockSessionsService.getActive.mockResolvedValue({
    //     id: 'session-id',
    //     rotatedAt: new Date(now)
    //   });

    //   mockClockService.snapshot.mockReturnValue({
    //     now,
    //     expiresAt: new Date(now + 1000)
    //   });

    //   await expect(service.refresh('token')).rejects.toEqual(
    //     SessionErrors.refreshRateLimited('session-id')
    //   );
    // });

    it('should revoke session on token reuse', async () => {
      const now = Date.now();

      const session = {
        id: 'session-id',
        refreshTokenHash: 'hash',
        owner: {
          id: 'user-id'
        }
      };

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockSessionsService.getActive.mockResolvedValue(session);

      mockClockService.snapshot.mockReturnValue({
        now,
        expiresAt: new Date(now + 1000)
      });

      mockHashingProvider.compare.mockResolvedValue(false);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.sessionReuseDetected('session-id')
      );

      expect(mockSessionsService.revoke).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
    });

    it('should throw when rotateRefreshToken fails', async () => {
      const now = Date.now();

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      mockSessionsService.getActive.mockResolvedValue({
        id: 'session-id',
        refreshTokenHash: 'hash',
        owner: {
          id: 'user-id'
        }
      });

      mockClockService.snapshot.mockReturnValue({
        now,
        expiresAt: new Date(now + 1000)
      });

      mockHashingProvider.compare.mockResolvedValue(true);

      mockTokenService.issuePair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh'
      });

      mockHashingProvider.hash.mockResolvedValue('new-hash');

      mockSessionsService.rotateAtomic.mockResolvedValue(false);

      await expect(service.refresh('token')).rejects.toEqual(
        SessionErrors.sessionReuseDetected('session-id')
      );
    });
  });
});
