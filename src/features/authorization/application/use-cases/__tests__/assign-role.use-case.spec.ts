import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserErrorCode } from '@features/users/domain/errors/user-error-code.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { AuthorizationErrors } from '../../../domain/errors/authorization-errors';
import { Permission } from '../../../domain/enums/permission.enum';
import { AssignRoleUseCase } from '../assign-role.use-case';

describe('AssignRoleUseCase', () => {
  let useCase: AssignRoleUseCase;

  const mockUserRepository = { findUserForAdmin: jest.fn() };
  const mockRoleRepository = { findById: jest.fn(), permissionsOf: jest.fn() };
  const mockUserRoleRepository = { assign: jest.fn() };
  const mockPermissionEvaluation = { assertCanDelegate: jest.fn() };
  const mockLogger = { setContext: jest.fn(), info: jest.fn() };

  const owner = { id: 'owner-1', role: UserRole.OWNER };
  const TARGET_ID = 'admin-2';
  const ROLE_ID = 'role-1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository.findUserForAdmin.mockResolvedValue({
      id: TARGET_ID,
      role: UserRole.ADMIN
    });
    mockRoleRepository.findById.mockResolvedValue({
      id: ROLE_ID,
      isSystem: false
    });
    mockRoleRepository.permissionsOf.mockResolvedValue([Permission.USER_READ]);
    mockPermissionEvaluation.assertCanDelegate.mockResolvedValue(undefined);

    useCase = new AssignRoleUseCase(
      mockUserRepository as any,
      mockRoleRepository as any,
      mockUserRoleRepository as any,
      mockPermissionEvaluation as any,
      mockLogger as any
    );
  });

  it('should assign the role and record who assigned it', async () => {
    await useCase.execute(owner, TARGET_ID, ROLE_ID);

    expect(mockUserRoleRepository.assign).toHaveBeenCalledWith(
      TARGET_ID,
      ROLE_ID,
      owner.id
    );
  });

  it('should refuse an unknown account', async () => {
    mockUserRepository.findUserForAdmin.mockResolvedValue(null);

    await expect(useCase.execute(owner, 'missing', ROLE_ID)).rejects.toThrow(
      expect.objectContaining({ code: UserErrorCode.USER_NOT_FOUND })
    );

    expect(mockUserRoleRepository.assign).not.toHaveBeenCalled();
  });

  it('should refuse the owner as a target', async () => {
    mockUserRepository.findUserForAdmin.mockResolvedValue({
      id: TARGET_ID,
      role: UserRole.OWNER
    });

    await expect(useCase.execute(owner, TARGET_ID, ROLE_ID)).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.OWNER_IMMUTABLE
      })
    );

    expect(mockUserRoleRepository.assign).not.toHaveBeenCalled();
  });

  it('should refuse self-assignment', async () => {
    mockUserRepository.findUserForAdmin.mockResolvedValue({
      id: owner.id,
      role: UserRole.ADMIN
    });

    await expect(useCase.execute(owner, owner.id, ROLE_ID)).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.SELF_MANAGEMENT_FORBIDDEN
      })
    );

    expect(mockUserRoleRepository.assign).not.toHaveBeenCalled();
  });

  it('should refuse an unknown role', async () => {
    mockRoleRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(owner, TARGET_ID, 'missing-role')
    ).rejects.toThrow(
      expect.objectContaining({ code: AuthorizationErrorCode.ROLE_NOT_FOUND })
    );

    expect(mockUserRoleRepository.assign).not.toHaveBeenCalled();
  });

  it('should refuse to assign a role granting a permission the caller does not hold', async () => {
    mockPermissionEvaluation.assertCanDelegate.mockRejectedValue(
      AuthorizationErrors.permissionNotHeld([Permission.SYSTEM_SETTINGS])
    );

    await expect(useCase.execute(owner, TARGET_ID, ROLE_ID)).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.PERMISSION_NOT_HELD
      })
    );

    expect(mockUserRoleRepository.assign).not.toHaveBeenCalled();
  });
});
