import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { UserErrorCode } from '@features/users/domain/errors/user-error-code.enum';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import { ProtectedAction } from '../../../domain/owner-protection.policy';
import { ChangeAdminStatusUseCase } from '../change-admin-status.use-case';

describe('ChangeAdminStatusUseCase', () => {
  let useCase: ChangeAdminStatusUseCase;

  const mockUserRepository = {
    updateStatus: jest.fn()
  };

  const mockRevocationUseCase = {
    revokeAll: jest.fn()
  };

  const mockAdminAccountService = {
    loadManageableAdmin: jest.fn()
  };

  const mockDataSource = {
    transaction: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  const OWNER_ID = 'owner-1';
  const TARGET_ID = 'admin-1';

  const manager = {} as any;

  const target = (status: UserStatus) => ({
    id: TARGET_ID,
    role: UserRole.ADMIN,
    status
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataSource.transaction.mockImplementation(
      (cb: (m: unknown) => Promise<void>) => cb(manager)
    );

    useCase = new ChangeAdminStatusUseCase(
      mockUserRepository as any,
      mockRevocationUseCase as any,
      mockAdminAccountService as any,
      mockDataSource as any,
      mockLogger as any
    );
  });

  describe('deactivate', () => {
    it('should deactivate and revoke every session in one transaction', async () => {
      mockAdminAccountService.loadManageableAdmin.mockResolvedValue(
        target(UserStatus.ACTIVATE)
      );

      await useCase.deactivate(OWNER_ID, TARGET_ID);

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.updateStatus).toHaveBeenCalledWith(
        TARGET_ID,
        UserStatus.DEACTIVATE,
        manager
      );
      expect(mockRevocationUseCase.revokeAll).toHaveBeenCalledWith(
        TARGET_ID,
        manager
      );
    });

    it.each([
      UserStatus.DEACTIVATE,
      UserStatus.SUSPEND,
      UserStatus.PENDING_VERIFICATION
    ])('should refuse to deactivate a %s administrator', async (status) => {
      mockAdminAccountService.loadManageableAdmin.mockResolvedValue(
        target(status)
      );

      await expect(useCase.deactivate(OWNER_ID, TARGET_ID)).rejects.toThrow(
        expect.objectContaining({
          code: UserErrorCode.INVALID_STATUS_TRANSITION,
          statusCode: 409
        })
      );

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should refuse to deactivate the owner', async () => {
      mockAdminAccountService.loadManageableAdmin.mockRejectedValue(
        UserErrors.userNotFound(TARGET_ID)
      );

      await expect(useCase.deactivate(OWNER_ID, TARGET_ID)).rejects.toThrow(
        expect.objectContaining({
          code: UserErrorCode.USER_NOT_FOUND
        })
      );
    });
  });

  describe('activate', () => {
    it('should restore a deactivated administrator without touching sessions', async () => {
      mockAdminAccountService.loadManageableAdmin.mockResolvedValue(
        target(UserStatus.DEACTIVATE)
      );

      await useCase.activate(OWNER_ID, TARGET_ID);

      expect(mockUserRepository.updateStatus).toHaveBeenCalledWith(
        TARGET_ID,
        UserStatus.ACTIVATE
      );
      expect(mockRevocationUseCase.revokeAll).not.toHaveBeenCalled();
    });

    /** Lifting a suspension is a separate decision, with its own notification. */
    it('should refuse to activate a suspended administrator', async () => {
      mockAdminAccountService.loadManageableAdmin.mockResolvedValue(
        target(UserStatus.SUSPEND)
      );

      await expect(useCase.activate(OWNER_ID, TARGET_ID)).rejects.toThrow(
        expect.objectContaining({
          code: UserErrorCode.INVALID_STATUS_TRANSITION
        })
      );

      expect(mockUserRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should refuse to activate an account that never verified its email', async () => {
      mockAdminAccountService.loadManageableAdmin.mockResolvedValue(
        target(UserStatus.PENDING_VERIFICATION)
      );

      await expect(useCase.activate(OWNER_ID, TARGET_ID)).rejects.toThrow(
        expect.objectContaining({
          code: UserErrorCode.INVALID_STATUS_TRANSITION
        })
      );
    });

    it('should validate the target as a status change', async () => {
      mockAdminAccountService.loadManageableAdmin.mockResolvedValue(
        target(UserStatus.DEACTIVATE)
      );

      await useCase.activate(OWNER_ID, TARGET_ID);

      expect(mockAdminAccountService.loadManageableAdmin).toHaveBeenCalledWith(
        OWNER_ID,
        TARGET_ID,
        ProtectedAction.STATUS_CHANGE
      );
    });
  });
});
