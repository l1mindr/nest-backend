import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { AuthorizationErrors } from '../../../domain/errors/authorization-errors';
import { Permission } from '../../../domain/enums/permission.enum';
import { SetRolePermissionsUseCase } from '../set-role-permissions.use-case';

describe('SetRolePermissionsUseCase', () => {
  let useCase: SetRolePermissionsUseCase;

  const mockRoleRepository = {
    findById: jest.fn(),
    setPermissions: jest.fn()
  };

  const mockPermissionEvaluation = {
    assertCanDelegate: jest.fn()
  };

  const mockLogger = { setContext: jest.fn(), info: jest.fn() };

  const owner = { id: 'owner-1', role: UserRole.OWNER };
  const customRole = {
    id: 'role-1',
    name: 'SUPPORT',
    description: '',
    isSystem: false
  };
  const systemRole = {
    id: 'role-admin',
    name: 'ADMIN',
    description: '',
    isSystem: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoleRepository.findById.mockResolvedValue(customRole);
    mockPermissionEvaluation.assertCanDelegate.mockResolvedValue(undefined);

    useCase = new SetRolePermissionsUseCase(
      mockRoleRepository as any,
      mockPermissionEvaluation as any,
      mockLogger as any
    );
  });

  it('should replace the permission set', async () => {
    await useCase.execute(owner, 'role-1', {
      permissions: [Permission.USER_READ]
    });

    expect(mockRoleRepository.setPermissions).toHaveBeenCalledWith('role-1', [
      Permission.USER_READ
    ]);
  });

  it('should refuse an unknown role', async () => {
    mockRoleRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(owner, 'missing', { permissions: [Permission.USER_READ] })
    ).rejects.toThrow(
      expect.objectContaining({ code: AuthorizationErrorCode.ROLE_NOT_FOUND })
    );
  });

  it('should refuse to change permissions on a system role', async () => {
    mockRoleRepository.findById.mockResolvedValue(systemRole);

    await expect(
      useCase.execute(owner, 'role-admin', {
        permissions: [Permission.USER_READ]
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: AuthorizationErrorCode.ROLE_PROTECTED })
    );

    expect(mockRoleRepository.setPermissions).not.toHaveBeenCalled();
  });

  it('should refuse to place a permission the caller does not hold into the role', async () => {
    mockPermissionEvaluation.assertCanDelegate.mockRejectedValue(
      AuthorizationErrors.permissionNotHeld([Permission.SYSTEM_SETTINGS])
    );

    await expect(
      useCase.execute(owner, 'role-1', {
        permissions: [Permission.SYSTEM_SETTINGS]
      })
    ).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.PERMISSION_NOT_HELD
      })
    );

    expect(mockRoleRepository.setPermissions).not.toHaveBeenCalled();
  });
});
