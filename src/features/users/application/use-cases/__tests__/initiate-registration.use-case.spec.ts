import { ClockService } from '@infrastructure/clock/clock.service';
import { emailDedupeKey } from '@infrastructure/email/email-dedupe.key';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
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

  const mockEmailPublisher = {
    publish: jest.fn()
  };

  const mockManager = { getRepository: jest.fn() };

  const mockDataSource = {
    transaction: jest.fn()
  };

  const pendingUser = {
    id: 'user-id',
    email: 'test@test.com'
  };

  const mockAuditLogService = {
    record: jest.fn()
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
    mockVerificationCodeRepository.store.mockResolvedValue({
      id: 'verification-code-id'
    });
    mockEmailPublisher.publish.mockResolvedValue(undefined);

    useCase = new InitiateRegistrationUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockVerificationCodeService as any,
      mockClockService as unknown as ClockService,
      mockEmailPublisher as unknown as EmailPublisher,
      mockDataSource as any,
      mockAuditLogService as any
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

    it('should queue the verification email with the code and expiry', async () => {
      await useCase.execute({} as any);

      expect(mockEmailPublisher.publish).toHaveBeenCalledWith(
        {
          type: EmailMessageType.VERIFICATION,
          to: 'test@test.com',
          data: {
            code: '123456',
            expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES
          }
        },
        {
          dedupeKey: emailDedupeKey(
            EmailMessageType.VERIFICATION,
            'verification-code-id'
          )
        }
      );
    });

    it('should queue the email only after the transaction commits', async () => {
      const order: string[] = [];

      mockDataSource.transaction.mockImplementation(
        async (callback: (manager: unknown) => Promise<unknown>) => {
          const result = await callback(mockManager);
          order.push('commit');

          return result;
        }
      );
      mockEmailPublisher.publish.mockImplementation(async () => {
        order.push('publish');
      });

      await useCase.execute({} as any);

      expect(order).toEqual(['commit', 'publish']);
    });

    it('should not queue an email when the transaction fails', async () => {
      mockUserRepository.insertUser.mockRejectedValue(new Error('unknown'));

      await expect(useCase.execute({} as any)).rejects.toThrow('unknown');

      expect(mockEmailPublisher.publish).not.toHaveBeenCalled();
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
