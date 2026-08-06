import { LogEvent } from '@infrastructure/logging/logging.constants';
import { ClockService } from '@infrastructure/clock/clock.service';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { UserStatus } from '../../../domain/enums/user-status.enum';
import { UserErrors } from '../../../domain/errors/user-errors';
import { UnsuspendUserUseCase } from '../unsuspend-user.use-case';

function mockUnsuspend(this: { status: string }): void {
  if (this.status !== UserStatus.SUSPEND) {
    throw UserErrors.invalidStatusTransition(this.status, UserStatus.ACTIVATE);
  }
  this.status = UserStatus.ACTIVATE;
}

describe('UnsuspendUserUseCase', () => {
  let useCase: UnsuspendUserUseCase;

  const mockUserRepository = {
    findUserForAdmin: jest.fn()
  };

  const mockEmailService = {
    sendUnsuspensionEmail: jest.fn()
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

  const now = new Date('2024-01-15T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockClockService.nowDate.mockReturnValue(now);
    mockDataSource.transaction.mockImplementation(
      (cb: (manager: any) => Promise<void>) =>
        cb({ getRepository: () => ({ update: jest.fn() }) })
    );

    useCase = new UnsuspendUserUseCase(
      mockUserRepository as any,
      mockEmailService as any,
      mockClockService as unknown as ClockService,
      mockDataSource as any,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should unsuspend suspended user, send email, and create security log', async () => {
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
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'user-1',
        email: 'suspended@test.com',
        name: 'Suspended User',
        role: UserRole.USER,
        status: UserStatus.SUSPEND,
        unsuspend: mockUnsuspend
      });

      await useCase.execute('admin-1', 'user-1', UserRole.USER);

      expect(mockUserRepository.findUserForAdmin).toHaveBeenCalledWith(
        'user-1'
      );

      const userRepo = capturedManager.getRepository('User');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        status: UserStatus.ACTIVATE
      });

      expect(mockEmailService.sendUnsuspensionEmail).toHaveBeenCalledWith(
        'suspended@test.com',
        'Suspended User',
        now
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.USER_UNSUSPENDED,
          adminId: 'admin-1',
          userId: 'user-1',
          previousStatus: UserStatus.SUSPEND,
          newStatus: UserStatus.ACTIVATE
        }),
        expect.any(String)
      );
    });

    it('should throw when user is not found', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(null);

      await expect(
        useCase.execute('admin-1', 'missing-id', UserRole.USER)
      ).rejects.toEqual(UserErrors.userNotFound('missing-id'));

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEmailService.sendUnsuspensionEmail).not.toHaveBeenCalled();
    });

    /**
     * The owner is never suspended, so is never a legitimate target here. The
     * check is asserted anyway so the invariant does not depend on the owner's
     * status happening to be right — and it answers `404` rather than a
     * distinct refusal, which would confirm the identifier is the owner's.
     */
    it('should answer NOT_FOUND for the owner rather than confirming it exists', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'owner-1',
        email: 'owner@test.com',
        name: 'Owner',
        role: UserRole.OWNER,
        status: UserStatus.SUSPEND,
        unsuspend: mockUnsuspend
      });

      await expect(
        useCase.execute('admin-1', 'owner-1', UserRole.USER)
      ).rejects.toEqual(UserErrors.userNotFound('owner-1'));

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEmailService.sendUnsuspensionEmail).not.toHaveBeenCalled();
    });

    it('should refuse the owner on the administrator route too', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'owner-1',
        email: 'owner@test.com',
        name: 'Owner',
        role: UserRole.OWNER,
        status: UserStatus.SUSPEND,
        unsuspend: mockUnsuspend
      });

      await expect(
        useCase.execute('owner-2', 'owner-1', UserRole.ADMIN)
      ).rejects.toEqual(UserErrors.userNotFound('owner-1'));

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    /**
     * The isolation rule in both directions: the user route cannot reach an
     * administrator, and the administrator route cannot reach a user.
     */
    it('should refuse an administrator when the user route is administering', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'admin-9',
        email: 'admin@test.com',
        name: 'An Administrator',
        role: UserRole.ADMIN,
        status: UserStatus.SUSPEND,
        unsuspend: mockUnsuspend
      });

      await expect(
        useCase.execute('admin-1', 'admin-9', UserRole.USER)
      ).rejects.toEqual(UserErrors.userNotFound('admin-9'));

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEmailService.sendUnsuspensionEmail).not.toHaveBeenCalled();
    });

    it('should unsuspend an administrator when the administrator route is administering', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'admin-9',
        email: 'admin@test.com',
        name: 'An Administrator',
        role: UserRole.ADMIN,
        status: UserStatus.SUSPEND,
        unsuspend: mockUnsuspend
      });

      await useCase.execute('owner-1', 'admin-9', UserRole.ADMIN);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEmailService.sendUnsuspensionEmail).toHaveBeenCalled();
    });

    it('should throw when user status is active', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'user-2',
        email: 'active@test.com',
        name: 'Active User',
        role: UserRole.USER,
        status: UserStatus.ACTIVATE,
        unsuspend: mockUnsuspend
      });

      await expect(
        useCase.execute('admin-1', 'user-2', UserRole.USER)
      ).rejects.toEqual(
        UserErrors.invalidStatusTransition(
          UserStatus.ACTIVATE,
          UserStatus.ACTIVATE
        )
      );

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEmailService.sendUnsuspensionEmail).not.toHaveBeenCalled();
    });

    it('should throw when user status is pending verification', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'user-3',
        email: 'pending@test.com',
        name: 'Pending User',
        role: UserRole.USER,
        status: UserStatus.PENDING_VERIFICATION,
        unsuspend: mockUnsuspend
      });

      await expect(
        useCase.execute('admin-1', 'user-3', UserRole.USER)
      ).rejects.toEqual(
        UserErrors.invalidStatusTransition(
          UserStatus.PENDING_VERIFICATION,
          UserStatus.ACTIVATE
        )
      );

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEmailService.sendUnsuspensionEmail).not.toHaveBeenCalled();
    });

    it('should throw when user status is deactivated', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'user-4',
        email: 'deactivated@test.com',
        name: 'Deactivated User',
        role: UserRole.USER,
        status: UserStatus.DEACTIVATE,
        unsuspend: mockUnsuspend
      });

      await expect(
        useCase.execute('admin-1', 'user-4', UserRole.USER)
      ).rejects.toEqual(
        UserErrors.invalidStatusTransition(
          UserStatus.DEACTIVATE,
          UserStatus.ACTIVATE
        )
      );

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEmailService.sendUnsuspensionEmail).not.toHaveBeenCalled();
    });

    it('should not send email when transaction fails', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'user-1',
        email: 'suspended@test.com',
        name: 'Suspended User',
        role: UserRole.USER,
        status: UserStatus.SUSPEND,
        unsuspend: mockUnsuspend
      });
      const dbError = new Error('Database failure');
      mockDataSource.transaction.mockRejectedValue(dbError);

      await expect(
        useCase.execute('admin-1', 'user-1', UserRole.USER)
      ).rejects.toThrow(dbError);

      expect(mockEmailService.sendUnsuspensionEmail).not.toHaveBeenCalled();
    });

    it('should not restore sessions or affect revoked sessions', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'user-1',
        email: 'suspended@test.com',
        name: 'Suspended User',
        role: UserRole.USER,
        status: UserStatus.SUSPEND,
        unsuspend: mockUnsuspend
      });

      await useCase.execute('admin-1', 'user-1', UserRole.USER);

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should use null as display name when user has no name', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue({
        id: 'user-1',
        email: 'suspended@test.com',
        name: null,
        role: UserRole.USER,
        status: UserStatus.SUSPEND,
        unsuspend: mockUnsuspend
      });

      await useCase.execute('admin-1', 'user-1', UserRole.USER);

      expect(mockEmailService.sendUnsuspensionEmail).toHaveBeenCalledWith(
        'suspended@test.com',
        null,
        now
      );
    });
  });
});
