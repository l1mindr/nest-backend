import { AuthorizationErrorCode } from '@features/authorization/domain/errors/authorization-error-code.enum';
import { ClockService } from '@infrastructure/clock/clock.service';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { UserStatus } from '../../../domain/enums/user-status.enum';
import { UserErrors } from '../../../domain/errors/user-errors';
import { SuspendUserUseCase } from '../suspend-user.use-case';

describe('SuspendUserUseCase', () => {
  let useCase: SuspendUserUseCase;

  const mockUserRepository = {
    findUserForAdmin: jest.fn()
  };

  const mockRevocationUseCase = {
    revokeAll: jest.fn()
  };

  const mockEmailService = {
    sendSuspensionEmail: jest.fn()
  };

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockDataSource = {
    transaction: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  const activeUser = {
    id: 'user-1',
    email: 'active@test.com',
    name: 'Active User',
    status: UserStatus.ACTIVATE
  };

  const suspendedUser = {
    id: 'user-2',
    email: 'suspended@test.com',
    name: 'Suspended User',
    status: UserStatus.SUSPEND
  };

  const now = new Date('2024-01-15T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockClockService.nowDate.mockReturnValue(now);
    mockDataSource.transaction.mockImplementation(
      (cb: (manager: any) => Promise<void>) =>
        cb({ getRepository: () => ({ update: jest.fn() }) })
    );

    useCase = new SuspendUserUseCase(
      mockUserRepository as any,
      mockRevocationUseCase as any,
      mockEmailService as any,
      mockClockService as unknown as ClockService,
      mockDataSource as any,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should suspend user, revoke sessions, and send email', async () => {
      let capturedManager: any;
      mockDataSource.transaction.mockImplementation(
        (cb: (manager: any) => Promise<void>) => {
          const manager = {
            getRepository: jest.fn().mockReturnValue({ update: jest.fn() })
          };
          capturedManager = manager;
          return cb(manager);
        }
      );
      mockUserRepository.findUserForAdmin.mockResolvedValue(activeUser);

      await useCase.execute('admin-1', 'user-1', 'Violation of terms');

      expect(mockUserRepository.findUserForAdmin).toHaveBeenCalledWith(
        'user-1'
      );

      const userRepo = capturedManager.getRepository('User');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        status: UserStatus.SUSPEND
      });

      expect(mockRevocationUseCase.revokeAll).toHaveBeenCalledWith(
        'user-1',
        capturedManager
      );

      expect(mockEmailService.sendSuspensionEmail).toHaveBeenCalledWith(
        'active@test.com',
        'Active User',
        'Violation of terms',
        now
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-1',
          userId: 'user-1',
          reason: 'Violation of terms'
        }),
        expect.any(String)
      );
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(null);

      await expect(
        useCase.execute('admin-1', 'missing-id', 'reason')
      ).rejects.toEqual(UserErrors.userNotFound('missing-id'));

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEmailService.sendSuspensionEmail).not.toHaveBeenCalled();
    });

    it('should refuse to suspend the owner', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        ...activeUser,
        id: 'owner-1',
        role: UserRole.OWNER
      });

      await expect(
        useCase.execute('admin-1', 'owner-1', 'reason')
      ).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.OWNER_IMMUTABLE,
          statusCode: 403
        })
      );

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockRevocationUseCase.revokeAll).not.toHaveBeenCalled();
      expect(mockEmailService.sendSuspensionEmail).not.toHaveBeenCalled();
    });

    it('should throw when user is already suspended', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(suspendedUser);

      await expect(
        useCase.execute('admin-1', 'user-2', 'reason')
      ).rejects.toEqual(UserErrors.userAlreadySuspended());

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEmailService.sendSuspensionEmail).not.toHaveBeenCalled();
    });

    it('should rollback transaction and not send email on failure', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(activeUser);
      const dbError = new Error('Database failure');
      mockDataSource.transaction.mockRejectedValue(dbError);

      await expect(
        useCase.execute('admin-1', 'user-1', 'reason')
      ).rejects.toThrow(dbError);

      expect(mockEmailService.sendSuspensionEmail).not.toHaveBeenCalled();
    });

    it('should use null as display name when user has no name', async () => {
      mockDataSource.transaction.mockImplementation(
        (cb: (manager: any) => Promise<void>) => {
          const manager = {
            getRepository: jest.fn().mockReturnValue({ update: jest.fn() })
          };
          return cb(manager);
        }
      );
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        ...activeUser,
        name: null
      });

      await useCase.execute('admin-1', 'user-1', 'reason');

      expect(mockEmailService.sendSuspensionEmail).toHaveBeenCalledWith(
        'active@test.com',
        null,
        'reason',
        now
      );
    });
  });
});
