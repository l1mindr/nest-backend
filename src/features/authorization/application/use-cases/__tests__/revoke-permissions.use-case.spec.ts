import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { AuthorizationErrors } from '../../../domain/errors/authorization-errors';
import { Permission } from '../../../domain/enums/permission.enum';
import { ProtectedAction } from '../../../domain/owner-protection.policy';
import { RevokePermissionsUseCase } from '../revoke-permissions.use-case';

describe('RevokePermissionsUseCase', () => {
  let useCase: RevokePermissionsUseCase;

  const mockAdminPermissionRepository = {
    revoke: jest.fn()
  };

  const mockPermissionEvaluation = {
    assertCanDelegate: jest.fn()
  };

  const mockAdminAccountService = {
    loadManageableAdmin: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  const owner = { id: 'owner-1', role: UserRole.OWNER };
  const admin = { id: 'admin-1', role: UserRole.ADMIN };
  const TARGET_ID = 'admin-2';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminAccountService.loadManageableAdmin.mockResolvedValue({
      id: TARGET_ID,
      role: UserRole.ADMIN
    });
    mockPermissionEvaluation.assertCanDelegate.mockResolvedValue(undefined);

    useCase = new RevokePermissionsUseCase(
      mockAdminPermissionRepository as any,
      mockPermissionEvaluation as any,
      mockAdminAccountService as any,
      mockLogger as any
    );
  });

  it('should revoke the permissions', async () => {
    await useCase.execute(owner, TARGET_ID, {
      permissions: [Permission.USER_SUSPEND]
    });

    expect(mockAdminPermissionRepository.revoke).toHaveBeenCalledWith(
      TARGET_ID,
      [Permission.USER_SUSPEND]
    );
  });

  it('should refuse the owner and self-targeting through the account service', async () => {
    await useCase.execute(admin, TARGET_ID, {
      permissions: [Permission.USER_READ]
    });

    expect(mockAdminAccountService.loadManageableAdmin).toHaveBeenCalledWith(
      admin.id,
      TARGET_ID,
      ProtectedAction.PERMISSION_REVOKE
    );
  });

  /**
   * Without this, an administrator holding only ROLE_ASSIGN could disarm a
   * colleague whose reach exceeds their own.
   */
  it('should refuse to revoke a permission the caller does not hold', async () => {
    mockPermissionEvaluation.assertCanDelegate.mockRejectedValue(
      AuthorizationErrors.permissionNotHeld([Permission.SYSTEM_SETTINGS])
    );

    await expect(
      useCase.execute(admin, TARGET_ID, {
        permissions: [Permission.SYSTEM_SETTINGS]
      })
    ).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.PERMISSION_NOT_HELD
      })
    );

    expect(mockAdminPermissionRepository.revoke).not.toHaveBeenCalled();
  });

  it('should let the owner revoke anything', async () => {
    await useCase.execute(owner, TARGET_ID, {
      permissions: [Permission.SYSTEM_SETTINGS, Permission.ROLE_ASSIGN]
    });

    expect(mockAdminPermissionRepository.revoke).toHaveBeenCalledWith(
      TARGET_ID,
      [Permission.SYSTEM_SETTINGS, Permission.ROLE_ASSIGN]
    );
  });

  it('should log the revocation for the audit trail', async () => {
    await useCase.execute(owner, TARGET_ID, {
      permissions: [Permission.USER_SUSPEND]
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: owner.id,
        userId: TARGET_ID,
        permissions: [Permission.USER_SUSPEND]
      }),
      expect.any(String)
    );
  });
});
