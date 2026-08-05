import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { AuthorizationErrors } from '../../../domain/errors/authorization-errors';
import { ProtectedAction } from '../../../domain/owner-protection.policy';
import { RevokeAdminRoleUseCase } from '../revoke-admin-role.use-case';

describe('RevokeAdminRoleUseCase', () => {
  let useCase: RevokeAdminRoleUseCase;

  const mockUserRepository = {
    updateRole: jest.fn()
  };

  const mockAdminPermissionRepository = {
    revokeAll: jest.fn()
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

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataSource.transaction.mockImplementation(
      (cb: (m: unknown) => Promise<void>) => cb(manager)
    );

    mockAdminAccountService.loadManageableAdmin.mockResolvedValue({
      id: TARGET_ID,
      role: UserRole.ADMIN
    });

    useCase = new RevokeAdminRoleUseCase(
      mockUserRepository as any,
      mockAdminPermissionRepository as any,
      mockRevocationUseCase as any,
      mockAdminAccountService as any,
      mockDataSource as any,
      mockLogger as any
    );
  });

  it('should demote to USER, purge the grants and revoke the sessions together', async () => {
    await useCase.execute(OWNER_ID, TARGET_ID);

    expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    expect(mockUserRepository.updateRole).toHaveBeenCalledWith(
      TARGET_ID,
      UserRole.USER,
      manager
    );
    expect(mockAdminPermissionRepository.revokeAll).toHaveBeenCalledWith(
      TARGET_ID,
      manager
    );
    expect(mockRevocationUseCase.revokeAll).toHaveBeenCalledWith(
      TARGET_ID,
      manager
    );
  });

  it('should refuse to demote the owner', async () => {
    mockAdminAccountService.loadManageableAdmin.mockRejectedValue(
      AuthorizationErrors.ownerImmutable(ProtectedAction.ROLE_CHANGE)
    );

    await expect(useCase.execute(OWNER_ID, TARGET_ID)).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.OWNER_IMMUTABLE
      })
    );

    expect(mockDataSource.transaction).not.toHaveBeenCalled();
  });

  it('should refuse to demote an account that is not an administrator', async () => {
    mockAdminAccountService.loadManageableAdmin.mockRejectedValue(
      AuthorizationErrors.notAnAdministrator(TARGET_ID)
    );

    await expect(useCase.execute(OWNER_ID, TARGET_ID)).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.NOT_AN_ADMINISTRATOR
      })
    );

    expect(mockUserRepository.updateRole).not.toHaveBeenCalled();
  });

  it('should validate the target for a role change', async () => {
    await useCase.execute(OWNER_ID, TARGET_ID);

    expect(mockAdminAccountService.loadManageableAdmin).toHaveBeenCalledWith(
      OWNER_ID,
      TARGET_ID,
      ProtectedAction.ROLE_CHANGE
    );
  });
});
