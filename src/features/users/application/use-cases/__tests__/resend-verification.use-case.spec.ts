import { ClockService } from '@infrastructure/clock/clock.service';
import { EmailService } from '@infrastructure/email/email.service';
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

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ResendVerificationUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockVerificationCodeService as any,
      mockClockService as unknown as ClockService,
      mockEmailService as unknown as EmailService
    );
  });

  describe('execute', () => {
    it('should invalidate previous codes and send new code', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com'
      });
      mockVerificationCodeService.generate.mockReturnValue('654321');
      mockVerificationCodeService.hash.mockResolvedValue('new-hash');

      await useCase.execute('test@test.com');

      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).toHaveBeenCalledWith('user-id', now);
      expect(mockVerificationCodeService.generate).toHaveBeenCalled();
      expect(mockVerificationCodeService.hash).toHaveBeenCalledWith('654321');
      expect(mockVerificationCodeRepository.store).toHaveBeenCalledWith(
        'user-id',
        'new-hash',
        expect.any(Date)
      );
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.com',
        '654321'
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
  });
});
