import { ClockService } from '@infrastructure/clock/clock.service';
import { ImperativeRateLimitPolicies } from '@features/security/rate-limit/config/rate-limit.config';
import { UserStatus } from '../../../domain/enums/user-status.enum';
import { UserErrors } from '../../../domain/errors/user-errors';
import { VerifyEmailUseCase } from '../verify-email.use-case';

const ATTEMPT_LIMIT = ImperativeRateLimitPolicies.VerificationAttempts.limit;

/** Shapes a consume() result with the headroom a test wants to simulate. */
const attemptResult = (remaining: number) => ({
  policy: ImperativeRateLimitPolicies.VerificationAttempts.name,
  allowed: remaining > 0,
  limit: ATTEMPT_LIMIT,
  remaining,
  resetAt: 0,
  retryAfterSeconds: 0,
  blocked: false,
  degraded: false
});

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;

  const mockUserRepository = {
    findByEmailOrUsernameForAuth: jest.fn(),
    updateStatus: jest.fn()
  };

  const mockVerificationCodeRepository = {
    findLatestByUserId: jest.fn(),
    markVerified: jest.fn(),
    invalidatePreviousCodes: jest.fn()
  };

  const mockVerificationCodeService = {
    isExpired: jest.fn(),
    validate: jest.fn()
  };

  const mockRateLimitService = {
    consume: jest.fn(),
    peek: jest.fn(),
    reset: jest.fn()
  };

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockManager = {};

  const mockDataSource = {
    transaction: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const pendingUser = { id: 'user-id', email: 'test@test.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation(
      async (callback: (manager: unknown) => Promise<unknown>) =>
        callback(mockManager)
    );
    mockRateLimitService.consume.mockResolvedValue(
      attemptResult(ATTEMPT_LIMIT - 1)
    );

    useCase = new VerifyEmailUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockVerificationCodeService as any,
      mockRateLimitService as any,
      mockClockService as unknown as ClockService,
      mockDataSource as any,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should verify email successfully inside a transaction', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        ...pendingUser,
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeRepository.findLatestByUserId.mockResolvedValue({
        id: 'code-id',
        codeHash: 'stored-hash',
        expiresAt: new Date('2024-01-01T00:03:00Z')
      });
      mockVerificationCodeService.isExpired.mockReturnValue(false);
      mockVerificationCodeService.validate.mockResolvedValue(true);

      await useCase.execute('test@test.com', '123456');

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockVerificationCodeService.validate).toHaveBeenCalledWith(
        '123456',
        'stored-hash'
      );
      expect(mockVerificationCodeRepository.markVerified).toHaveBeenCalledWith(
        'code-id',
        now,
        mockManager
      );
      expect(mockUserRepository.updateStatus).toHaveBeenCalledWith(
        'user-id',
        UserStatus.ACTIVATE,
        mockManager
      );
      expect(mockRateLimitService.reset).toHaveBeenCalledWith(
        ImperativeRateLimitPolicies.VerificationAttempts,
        'user-id'
      );
    });

    it('should throw invalid verification code when user not found', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue(null);

      await expect(
        useCase.execute('unknown@test.com', '123456')
      ).rejects.toEqual(UserErrors.invalidVerificationCode());
    });

    it('should throw invalid verification code for an already verified account', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.ACTIVATE
      });

      await expect(useCase.execute('test@test.com', '123456')).rejects.toEqual(
        UserErrors.invalidVerificationCode()
      );
    });

    it('should throw invalid verification code when user is DEACTIVATE', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.DEACTIVATE
      });

      await expect(useCase.execute('test@test.com', '123456')).rejects.toEqual(
        UserErrors.invalidVerificationCode()
      );
    });

    it('should throw invalid verification code when user is SUSPEND', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.SUSPEND
      });

      await expect(useCase.execute('test@test.com', '123456')).rejects.toEqual(
        UserErrors.invalidVerificationCode()
      );
    });

    it('should throw invalid verification code when no pending verification', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeRepository.findLatestByUserId.mockResolvedValue(null);

      await expect(useCase.execute('test@test.com', '123456')).rejects.toEqual(
        UserErrors.invalidVerificationCode()
      );
    });

    it('should throw generic invalid code for an expired verification code', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeRepository.findLatestByUserId.mockResolvedValue({
        id: 'code-id',
        codeHash: 'stored-hash',
        expiresAt: new Date('2024-01-01T00:03:00Z')
      });
      mockVerificationCodeService.isExpired.mockReturnValue(true);

      await expect(useCase.execute('test@test.com', '123456')).rejects.toEqual(
        UserErrors.invalidVerificationCode()
      );

      expect(
        mockVerificationCodeRepository.markVerified
      ).not.toHaveBeenCalled();
      expect(mockUserRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw invalid verification code when code does not match', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeRepository.findLatestByUserId.mockResolvedValue({
        id: 'code-id',
        codeHash: 'stored-hash',
        expiresAt: new Date('2024-01-01T00:03:00Z')
      });
      mockVerificationCodeService.isExpired.mockReturnValue(false);
      mockVerificationCodeService.validate.mockResolvedValue(false);
      mockRateLimitService.consume.mockResolvedValue(
        attemptResult(ATTEMPT_LIMIT - 1)
      );

      await expect(
        useCase.execute('test@test.com', 'wrong-code')
      ).rejects.toEqual(UserErrors.invalidVerificationCode());

      expect(mockRateLimitService.consume).toHaveBeenCalledWith(
        ImperativeRateLimitPolicies.VerificationAttempts,
        'user-id'
      );
      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).not.toHaveBeenCalled();
      expect(
        mockVerificationCodeRepository.markVerified
      ).not.toHaveBeenCalled();
      expect(mockUserRepository.updateStatus).not.toHaveBeenCalled();
    });

    it(`should invalidate the code after ${ATTEMPT_LIMIT} failed attempts`, async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeRepository.findLatestByUserId.mockResolvedValue({
        id: 'code-id',
        codeHash: 'stored-hash',
        expiresAt: new Date('2024-01-01T00:03:00Z')
      });
      mockVerificationCodeService.isExpired.mockReturnValue(false);
      mockVerificationCodeService.validate.mockResolvedValue(false);
      // No headroom left is what the final permitted attempt looks like.
      mockRateLimitService.consume.mockResolvedValue(attemptResult(0));

      await expect(
        useCase.execute('test@test.com', 'wrong-code')
      ).rejects.toEqual(UserErrors.invalidVerificationCode());

      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).toHaveBeenCalledWith('user-id', now);
      expect(mockRateLimitService.reset).toHaveBeenCalledWith(
        ImperativeRateLimitPolicies.VerificationAttempts,
        'user-id'
      );
    });

    it('should invalidate the code when the count overshoots under concurrency', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeRepository.findLatestByUserId.mockResolvedValue({
        id: 'code-id',
        codeHash: 'stored-hash',
        expiresAt: new Date('2024-01-01T00:03:00Z')
      });
      mockVerificationCodeService.isExpired.mockReturnValue(false);
      mockVerificationCodeService.validate.mockResolvedValue(false);
      mockRateLimitService.consume.mockResolvedValue({
        ...attemptResult(0),
        allowed: false
      });

      await expect(
        useCase.execute('test@test.com', 'wrong-code')
      ).rejects.toEqual(UserErrors.invalidVerificationCode());

      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).toHaveBeenCalledWith('user-id', now);
    });
  });
});
