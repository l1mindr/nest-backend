import { ClockService } from '@infrastructure/clock/clock.service';
import { EmailService } from '@infrastructure/email/email.service';
import { UserStatus } from '../../../domain/enums/user-status.enum';
import { UserErrors } from '../../../domain/errors/user-errors';
import { InitiateRegistrationUseCase } from '../initiate-registration.use-case';

describe('InitiateRegistrationUseCase', () => {
  let useCase: InitiateRegistrationUseCase;

  const mockUserRepository = {
    insertUser: jest.fn()
  };

  const mockVerificationCodeRepository = {
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
    useCase = new InitiateRegistrationUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockVerificationCodeService as any,
      mockClockService as unknown as ClockService,
      mockEmailService as unknown as EmailService
    );
  });

  describe('execute', () => {
    it('should create user with PENDING_VERIFICATION status', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.insertUser.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com'
      });
      mockVerificationCodeService.generate.mockReturnValue('123456');
      mockVerificationCodeService.hash.mockResolvedValue('hashed-code');

      await useCase.execute({
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed-password'
      } as any);

      expect(mockUserRepository.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@test.com',
          username: 'testuser',
          password: 'hashed-password',
          status: UserStatus.PENDING_VERIFICATION
        })
      );
    });

    it('should generate and store verification code', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.insertUser.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com'
      });
      mockVerificationCodeService.generate.mockReturnValue('123456');
      mockVerificationCodeService.hash.mockResolvedValue('hashed-code');

      await useCase.execute({} as any);

      expect(mockVerificationCodeService.generate).toHaveBeenCalled();
      expect(mockVerificationCodeService.hash).toHaveBeenCalledWith('123456');
      expect(mockVerificationCodeRepository.store).toHaveBeenCalledWith(
        'user-id',
        'hashed-code',
        expect.any(Date)
      );
    });

    it('should send verification email with code', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(now);
      mockUserRepository.insertUser.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com'
      });
      mockVerificationCodeService.generate.mockReturnValue('123456');
      mockVerificationCodeService.hash.mockResolvedValue('hashed-code');

      await useCase.execute({} as any);

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.com',
        '123456'
      );
    });

    it('should propagate unique constraint errors', async () => {
      const dbError = { code: '23505', detail: 'email' };
      mockUserRepository.insertUser.mockRejectedValue(dbError);

      await expect(useCase.execute({} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('unknown');
      mockUserRepository.insertUser.mockRejectedValue(error);

      await expect(useCase.execute({} as any)).rejects.toThrow(error);
    });
  });
});
