import { ClockService } from '@core/clock/clock.service';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
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
    issue: jest.fn()
  };

  const mockTokenService = {
    issuePair: jest.fn()
  };

  const mockUsersService = {
    findByIdentifierForAuth: jest.fn()
  };

  const mockDataSource = {
    getRepository: jest.fn()
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
      mockUsersService as any,
      mockDataSource as unknown as DataSource,
      mockLogger as any
    );
  });

  describe('login', () => {
    it('should login successfully', async () => {
      mockUsersService.findByIdentifierForAuth.mockResolvedValue({
        id: 'user-id',
        password: 'hashed-password',
        status: UserStatus.ACTIVATE
      });

      mockHashingProvider.compare.mockResolvedValue(true);

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

      const result = await service.login(
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
        service.login(
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
        service.login(
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
          service.login(
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
});
