import { ClockService } from '@infrastructure/clock/clock.service';
import { EmailService } from '@infrastructure/email/email.service';
import { UserStatus } from '../../../domain/enums/user-status.enum';
import { UserErrors } from '../../../domain/errors/user-errors';
import { VERIFICATION_CODE_TTL_MINUTES } from '../../verification.constants';
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

  const mockManager = { getRepository: jest.fn() };

  const mockDataSource = {
    transaction: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const pendingUser = {
    id: 'user-id',
    email: 'test@test.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation(
      async (callback: (manager: unknown) => Promise<unknown>) =>
        callback(mockManager)
    );
    mockUserRepository.insertUser.mockResolvedValue(pendingUser);
    mockVerificationCodeService.generate.mockReturnValue('123456');
    mockVerificationCodeService.hash.mockResolvedValue('hashed-code');
    mockClockService.nowDate.mockReturnValue(new Date('2024-01-01T00:00:00Z'));

    useCase = new InitiateRegistrationUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockVerificationCodeService as any,
      mockClockService as unknown as ClockService,
      mockEmailService as unknown as EmailService,
      mockDataSource as any,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should create user with PENDING_VERIFICATION status in a transaction', async () => {
      await useCase.execute({
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed-password'
      } as any);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockUserRepository.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@test.com',
          username: 'testuser',
          password: 'hashed-password',
          status: UserStatus.PENDING_VERIFICATION
        }),
        mockManager
      );
    });

    it('should generate and store verification code in the same transaction', async () => {
      await useCase.execute({} as any);

      expect(mockVerificationCodeService.generate).toHaveBeenCalled();
      expect(mockVerificationCodeService.hash).toHaveBeenCalledWith('123456');
      expect(mockVerificationCodeRepository.store).toHaveBeenCalledWith(
        'user-id',
        'hashed-code',
        expect.any(Date),
        mockManager
      );
    });

    it('should send verification email with code and expiry', async () => {
      await useCase.execute({} as any);

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.com',
        '123456',
        VERIFICATION_CODE_TTL_MINUTES
      );
    });

    it('should not throw when email delivery fails', async () => {
      mockEmailService.sendVerificationEmail.mockRejectedValue(
        new Error('smtp down')
      );

      await expect(useCase.execute({} as any)).resolves.toBeUndefined();

      expect(mockUserRepository.insertUser).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
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
