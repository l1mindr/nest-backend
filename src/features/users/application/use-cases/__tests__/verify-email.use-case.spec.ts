import { ClockService } from '@infrastructure/clock/clock.service';
import { UserStatus } from '../../../domain/enums/user-status.enum';
import { UserErrors } from '../../../domain/errors/user-errors';
import { VerifyEmailUseCase } from '../verify-email.use-case';

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;

  const mockUserRepository = {
    findByEmailOrUsernameForAuth: jest.fn(),
    updateStatus: jest.fn()
  };

  const mockVerificationCodeRepository = {
    findLatestByUserId: jest.fn(),
    markVerified: jest.fn()
  };

  const mockVerificationCodeService = {
    isExpired: jest.fn(),
    validate: jest.fn()
  };

  const mockClockService = {
    nowDate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new VerifyEmailUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockVerificationCodeService as any,
      mockClockService as unknown as ClockService
    );
  });

  describe('execute', () => {
    it('should verify email successfully', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeRepository.findLatestByUserId.mockResolvedValue({
        id: 'code-id',
        codeHash: 'stored-hash',
        registryDates: { createdAt: new Date('2024-01-01T00:00:00Z') }
      });
      mockVerificationCodeService.isExpired.mockReturnValue(false);
      mockVerificationCodeService.validate.mockResolvedValue(true);

      await useCase.execute('test@test.com', '123456');

      expect(mockVerificationCodeService.validate).toHaveBeenCalledWith(
        '123456',
        'stored-hash'
      );
      expect(mockVerificationCodeRepository.markVerified).toHaveBeenCalledWith(
        'code-id',
        now
      );
      expect(mockUserRepository.updateStatus).toHaveBeenCalledWith(
        'user-id',
        UserStatus.ACTIVATE
      );
    });

    it('should throw invalid verification code when user not found', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue(null);

      await expect(
        useCase.execute('unknown@test.com', '123456')
      ).rejects.toEqual(UserErrors.invalidVerificationCode());
    });

    it('should throw already verified when user status is ACTIVATE', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.ACTIVATE
      });

      await expect(useCase.execute('test@test.com', '123456')).rejects.toEqual(
        UserErrors.alreadyVerified()
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

    it('should throw expired verification code', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.PENDING_VERIFICATION
      });
      mockVerificationCodeRepository.findLatestByUserId.mockResolvedValue({
        id: 'code-id',
        codeHash: 'stored-hash',
        registryDates: { createdAt: new Date('2024-01-01T00:00:00Z') }
      });
      mockVerificationCodeService.isExpired.mockReturnValue(true);

      await expect(useCase.execute('test@test.com', '123456')).rejects.toEqual(
        UserErrors.expiredVerificationCode()
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
        registryDates: { createdAt: new Date('2024-01-01T00:00:00Z') }
      });
      mockVerificationCodeService.isExpired.mockReturnValue(false);
      mockVerificationCodeService.validate.mockResolvedValue(false);

      await expect(
        useCase.execute('test@test.com', 'wrong-code')
      ).rejects.toEqual(UserErrors.invalidVerificationCode());

      expect(
        mockVerificationCodeRepository.markVerified
      ).not.toHaveBeenCalled();
      expect(mockUserRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
