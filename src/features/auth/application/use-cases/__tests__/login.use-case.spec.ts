import { ClockService } from '@core/clock/clock.service';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { createHash } from 'crypto';
import { AuthErrors } from '../../../domain/errors/auth-errors';
import { Login } from '../../use-cases/login.use-case';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const NOW_MS = 1710000000000;
const EXPIRES_AT = new Date(NOW_MS + 1000);

describe('Login', () => {
  let service: Login;

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

  const mockSessionIssueUseCase = {
    execute: jest.fn()
  };

  const mockTokenIssueService = {
    issuePair: jest.fn()
  };

  const mockUserQueryService = {
    findByEmailOrUsername: jest.fn()
  };

  const mockSessionRotationUseCase = {
    saveHash: jest.fn()
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

    service = new Login(
      mockDeviceMapper as unknown as DeviceMapper,
      mockClockService as unknown as ClockService,
      mockHashingProvider as any,
      mockRefreshTokenHasher as any,
      mockSessionIssueUseCase as any,
      mockTokenIssueService as any,
      mockUserQueryService as any,
      mockSessionRotationUseCase as any,
      mockLogger as any
    );
  });

  describe('login', () => {
    it('should login successfully', async () => {
      mockUserQueryService.findByEmailOrUsername.mockResolvedValue({
        id: 'user-id',
        password: 'hashed-password',
        status: UserStatus.ACTIVATE
      });

      mockHashingProvider.compare.mockResolvedValue(true);

      mockSessionIssueUseCase.execute.mockResolvedValue({
        id: 'session-id'
      });

      mockTokenIssueService.issuePair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      mockSessionRotationUseCase.saveHash.mockResolvedValue(undefined);

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
      expect(mockSessionRotationUseCase.saveHash).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session-id',
          refreshTokenHash: sha256('refresh-token')
        })
      );
    });

    it('should throw when user not found', async () => {
      mockUserQueryService.findByEmailOrUsername.mockResolvedValue(null);

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
      mockUserQueryService.findByEmailOrUsername.mockResolvedValue({
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
        mockUserQueryService.findByEmailOrUsername.mockResolvedValue({
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

        expect(mockSessionIssueUseCase.execute).not.toHaveBeenCalled();
        expect(mockTokenIssueService.issuePair).not.toHaveBeenCalled();
      }
    );
  });
});
