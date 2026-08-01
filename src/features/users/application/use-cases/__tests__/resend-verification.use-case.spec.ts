import { ClockService } from '@infrastructure/clock/clock.service';
import { EmailService } from '@infrastructure/email/email.service';
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

  const mockVerificationAttemptService = {
    isResendHourlyLimitExceeded: jest.fn(),
    acquireResendCooldown: jest.fn(),
    resetFailedAttempts: jest.fn()
  };

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
    mockVerificationAttemptService.isResendHourlyLimitExceeded.mockResolvedValue(
      false
    );

    useCase = new ResendVerificationUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockVerificationCodeService as any,
      mockVerificationAttemptService as any,
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
      mockVerificationAttemptService.acquireResendCooldown.mockResolvedValue(
        true
      );
      mockVerificationCodeService.generate.mockReturnValue('654321');
      mockVerificationCodeService.hash.mockResolvedValue('new-hash');

      await useCase.execute('test@test.com');

      expect(
        mockVerificationAttemptService.isResendHourlyLimitExceeded
      ).toHaveBeenCalledWith('user-id');
      expect(
        mockVerificationAttemptService.acquireResendCooldown
      ).toHaveBeenCalledWith('user-id');
      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).toHaveBeenCalledWith('user-id', now);
      expect(
        mockVerificationAttemptService.resetFailedAttempts
      ).toHaveBeenCalledWith('user-id');
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

      expect(
        mockVerificationAttemptService.acquireResendCooldown
      ).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should not resend while the cooldown is active', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationAttemptService.acquireResendCooldown.mockResolvedValue(
        false
      );

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
      mockVerificationAttemptService.isResendHourlyLimitExceeded.mockResolvedValue(
        true
      );

      await useCase.execute('test@test.com');

      expect(
        mockVerificationAttemptService.acquireResendCooldown
      ).not.toHaveBeenCalled();
      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should not throw when email delivery fails', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationAttemptService.acquireResendCooldown.mockResolvedValue(
        true
      );
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
