import { ClockService } from '@core/clock/clock.service';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { createHash } from 'crypto';
import { AuthErrors } from '../errors/auth-errors';
import { LoginUserService } from './login-user.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const NOW_MS = 1710000000000;
const EXPIRES_AT = new Date(NOW_MS + 1000);

describe('LoginUserService', () => {
  let service: LoginUserService;

  const mockDeviceMapper = {
    toSessionUserAgent: jest.fn()
  };

  const mockClockService = {
    snapshot: jest.fn()
  };

  const mockHashingProvider = {
    compare: jest.fn()
  };

  const mockRefreshTokenHasher = {
    hash: jest.fn()
  };

  const mockIssueSessionService = {
    createSession: jest.fn()
  };

  const mockTokenService = {
    issuePair: jest.fn()
  };

  const mockUserRepository = {
    findByEmailOrUsernameForAuth: jest.fn()
  };

  const mockSessionRepository = {
    saveRefreshTokenHash: jest.fn()
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

    mockDeviceMapper.toSessionUserAgent.mockReturnValue({
      browserName: 'Chrome',
      browserVersion: '120.0.0.0',
      osName: 'Windows',
      deviceType: 'desktop'
    });

    mockRefreshTokenHasher.hash.mockImplementation((t: string) => sha256(t));

    service = new LoginUserService(
      mockDeviceMapper as unknown as DeviceMapper,
      mockClockService as unknown as ClockService,
      mockHashingProvider as any,
      mockRefreshTokenHasher as any,
      mockIssueSessionService as any,
      mockTokenService as any,
      mockUserRepository as any,
      mockSessionRepository as any,
      mockLogger as any
    );
  });

  describe('loginUser', () => {
    it('should login successfully', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        password: 'hashed-password',
        status: UserStatus.ACTIVATE
      });

      mockHashingProvider.compare.mockResolvedValue(true);

      mockIssueSessionService.createSession.mockResolvedValue({
        id: 'session-id'
      });

      mockTokenService.issuePair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      mockSessionRepository.saveRefreshTokenHash.mockResolvedValue(undefined);

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
      expect(mockSessionRepository.saveRefreshTokenHash).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session-id',
          refreshTokenHash: sha256('refresh-token')
        })
      );
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue(null);

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
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
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
        mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
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

        expect(mockIssueSessionService.createSession).not.toHaveBeenCalled();
        expect(mockTokenService.issuePair).not.toHaveBeenCalled();
      }
    );
  });
});
