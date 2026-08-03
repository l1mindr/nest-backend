import { ClockService } from '@infrastructure/clock/clock.service';
import { EmailService } from '@infrastructure/email/email.service';
import { ImperativeRateLimitPolicies } from '@features/security/rate-limit/config/rate-limit.config';
import { RateLimitRule } from '@features/security/rate-limit/types/rate-limit-rule.interface';
import { UserStatus } from '../../../domain/enums/user-status.enum';
import { VERIFICATION_CODE_TTL_MINUTES } from '../../verification.constants';
import { ResendVerificationUseCase } from '../resend-verification.use-case';

describe('ResendVerificationUseCase', () => {
  let useCase: ResendVerificationUseCase;

  const mockUserRepository = {
    findByEmailOrUsernameForAuth: jest.fn()
  };

  const mockVerificationCodeRepository = {
    invalidatePreviousCodes: jest.fn(),
    store: jest.fn()
  };

  const mockVerificationCodeService = {
    generate: jest.fn(),
    hash: jest.fn()
  };

  const mockRateLimitService = {
    consume: jest.fn(),
    peek: jest.fn(),
    reset: jest.fn()
  };

  const consumeResult = (allowed: boolean) => ({
    policy: 'test',
    allowed,
    limit: 5,
    remaining: allowed ? 4 : 0,
    resetAt: 0,
    retryAfterSeconds: 0,
    blocked: false,
    degraded: false
  });

  /** Answers each policy independently, since the use case consumes two. */
  const allowPolicies = (denied: RateLimitRule[] = []) =>
    mockRateLimitService.consume.mockImplementation(
      async (rule: RateLimitRule) => consumeResult(!denied.includes(rule))
    );

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    allowPolicies();

    useCase = new ResendVerificationUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockVerificationCodeService as any,
      mockRateLimitService as any,
      mockClockService as unknown as ClockService,
      mockEmailService as unknown as EmailService,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should invalidate previous codes and send new code', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeService.generate.mockReturnValue('654321');
      mockVerificationCodeService.hash.mockResolvedValue('new-hash');

      await useCase.execute('test@test.com');

      expect(mockRateLimitService.consume).toHaveBeenCalledWith(
        ImperativeRateLimitPolicies.ResendHourly,
        'user-id'
      );
      expect(mockRateLimitService.consume).toHaveBeenCalledWith(
        ImperativeRateLimitPolicies.ResendCooldown,
        'user-id'
      );
      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).toHaveBeenCalledWith('user-id', now);
      expect(mockRateLimitService.reset).toHaveBeenCalledWith(
        ImperativeRateLimitPolicies.VerificationAttempts,
        'user-id'
      );
      expect(mockVerificationCodeService.generate).toHaveBeenCalled();
      expect(mockVerificationCodeService.hash).toHaveBeenCalledWith('654321');
      expect(mockVerificationCodeRepository.store).toHaveBeenCalledWith(
        'user-id',
        'new-hash',
        expect.any(Date)
      );
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.com',
        '654321',
        VERIFICATION_CODE_TTL_MINUTES
      );
    });

    it('should silently return when user not found', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue(null);

      await useCase.execute('unknown@test.com');

      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should not resend for a non-pending user', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        status: UserStatus.ACTIVATE
      });

      await useCase.execute('test@test.com');

      expect(mockRateLimitService.consume).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should not resend while the cooldown is active', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        status: UserStatus.PENDING_VERIFICATION
      });
      allowPolicies([ImperativeRateLimitPolicies.ResendCooldown]);

      await useCase.execute('test@test.com');

      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should not resend once the hourly limit is reached', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        status: UserStatus.PENDING_VERIFICATION
      });
      allowPolicies([ImperativeRateLimitPolicies.ResendHourly]);

      await useCase.execute('test@test.com');

      // The cooldown must not even be consumed once the hourly budget is gone.
      expect(mockRateLimitService.consume).not.toHaveBeenCalledWith(
        ImperativeRateLimitPolicies.ResendCooldown,
        'user-id'
      );
      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should stay silent rather than surfacing a rate limit error', async () => {
      // Returning 429 here would let a caller tell a rate-limited address from
      // an unregistered one.
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        status: UserStatus.PENDING_VERIFICATION
      });
      allowPolicies([ImperativeRateLimitPolicies.ResendHourly]);

      await expect(useCase.execute('test@test.com')).resolves.toBeUndefined();
    });

    it('should not throw when email delivery fails', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeService.generate.mockReturnValue('654321');
      mockVerificationCodeService.hash.mockResolvedValue('new-hash');
      mockEmailService.sendVerificationEmail.mockRejectedValue(
        new Error('smtp down')
      );

      await expect(useCase.execute('test@test.com')).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
