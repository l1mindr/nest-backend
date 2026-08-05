import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { AuthorizationErrors } from '../../../domain/errors/authorization-errors';
import { Permission } from '../../../domain/enums/permission.enum';
import { ProtectedAction } from '../../../domain/owner-protection.policy';
import { GrantPermissionsUseCase } from '../grant-permissions.use-case';

describe('GrantPermissionsUseCase', () => {
  let useCase: GrantPermissionsUseCase;

  const mockAdminPermissionRepository = {
    grant: jest.fn()
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

    useCase = new GrantPermissionsUseCase(
      mockAdminPermissionRepository as any,
      mockPermissionEvaluation as any,
      mockAdminAccountService as any,
      mockLogger as any
    );
  });

  it('should grant the permissions and record who granted them', async () => {
    await useCase.execute(owner, TARGET_ID, {
      permissions: [Permission.USER_READ, Permission.USER_SUSPEND]
    });

    expect(mockAdminPermissionRepository.grant).toHaveBeenCalledWith(
      TARGET_ID,
      [Permission.USER_READ, Permission.USER_SUSPEND],
      owner.id
    );
  });

  it('should validate the target before touching the grant table', async () => {
    mockAdminAccountService.loadManageableAdmin.mockRejectedValue(
      AuthorizationErrors.notAnAdministrator(TARGET_ID)
    );

    await expect(
      useCase.execute(owner, TARGET_ID, {
        permissions: [Permission.USER_READ]
      })
    ).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.NOT_AN_ADMINISTRATOR
      })
    );

    expect(mockAdminPermissionRepository.grant).not.toHaveBeenCalled();
  });

  it('should ask the account service to refuse the owner and self-targeting', async () => {
    await useCase.execute(admin, TARGET_ID, {
      permissions: [Permission.USER_READ]
    });

    expect(mockAdminAccountService.loadManageableAdmin).toHaveBeenCalledWith(
      admin.id,
      TARGET_ID,
      ProtectedAction.PERMISSION_GRANT
    );
  });

  it('should refuse to pass on a permission the caller does not hold', async () => {
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

    expect(mockAdminPermissionRepository.grant).not.toHaveBeenCalled();
  });

  it('should check delegation before writing, not after', async () => {
    mockPermissionEvaluation.assertCanDelegate.mockRejectedValue(
      AuthorizationErrors.permissionNotHeld([Permission.USER_DELETE])
    );

    await expect(
      useCase.execute(admin, TARGET_ID, {
        permissions: [Permission.USER_DELETE]
      })
    ).rejects.toThrow();

    expect(mockPermissionEvaluation.assertCanDelegate).toHaveBeenCalledWith(
      admin,
      [Permission.USER_DELETE]
    );
    expect(mockAdminPermissionRepository.grant).not.toHaveBeenCalled();
  });

  it('should log the grant for the audit trail', async () => {
    await useCase.execute(owner, TARGET_ID, {
      permissions: [Permission.AUDIT_READ]
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: owner.id,
        userId: TARGET_ID,
        permissions: [Permission.AUDIT_READ]
      }),
      expect.any(String)
    );
  });
});
