import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { AuthorizationErrors } from '../../../domain/errors/authorization-errors';
import { Permission } from '../../../domain/enums/permission.enum';
import { GrantAdminRoleUseCase } from '../grant-admin-role.use-case';

describe('GrantAdminRoleUseCase', () => {
  let useCase: GrantAdminRoleUseCase;

  const mockUserRepository = {
    updateRole: jest.fn()
  };

  const mockAdminPermissionRepository = {
    grant: jest.fn()
  };

  const mockAdminAccountService = {
    loadPromotableUser: jest.fn()
  };

  const mockDataSource = {
    transaction: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  const OWNER_ID = 'owner-1';
  const TARGET_ID = 'user-1';

  const manager = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataSource.transaction.mockImplementation(
      (cb: (m: unknown) => Promise<void>) => cb(manager)
    );

    mockAdminAccountService.loadPromotableUser.mockResolvedValue({
      id: TARGET_ID,
      role: UserRole.USER,
      status: UserStatus.ACTIVATE
    });

    useCase = new GrantAdminRoleUseCase(
      mockUserRepository as any,
      mockAdminPermissionRepository as any,
      mockAdminAccountService as any,
      mockDataSource as any,
      mockLogger as any
    );
  });

  it('should promote the account to ADMIN', async () => {
    await useCase.execute(OWNER_ID, { userId: TARGET_ID });

    expect(mockUserRepository.updateRole).toHaveBeenCalledWith(
      TARGET_ID,
      UserRole.ADMIN,
      manager
    );
  });

  it('should apply the opening permissions in the same transaction as the role change', async () => {
    await useCase.execute(OWNER_ID, {
      userId: TARGET_ID,
      permissions: [Permission.USER_READ, Permission.USER_SUSPEND]
    });

    expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    expect(mockUserRepository.updateRole).toHaveBeenCalledWith(
      TARGET_ID,
      UserRole.ADMIN,
      manager
    );
    expect(mockAdminPermissionRepository.grant).toHaveBeenCalledWith(
      TARGET_ID,
      [Permission.USER_READ, Permission.USER_SUSPEND],
      OWNER_ID,
      manager
    );
  });

  it('should promote with no permissions when none are supplied', async () => {
    const result = await useCase.execute(OWNER_ID, { userId: TARGET_ID });

    expect(mockAdminPermissionRepository.grant).toHaveBeenCalledWith(
      TARGET_ID,
      [],
      OWNER_ID,
      manager
    );
    expect(result.permissions).toEqual([]);
  });

  it('should report the promoted account as an administrator', async () => {
    const result = await useCase.execute(OWNER_ID, {
      userId: TARGET_ID,
      permissions: [Permission.USER_READ]
    });

    expect(result.account.role).toBe(UserRole.ADMIN);
    expect(result.permissions).toEqual([Permission.USER_READ]);
  });

  it('should refuse an account that cannot be promoted', async () => {
    mockAdminAccountService.loadPromotableUser.mockRejectedValue(
      AuthorizationErrors.accountNotEligible(UserStatus.PENDING_VERIFICATION)
    );

    await expect(
      useCase.execute(OWNER_ID, { userId: TARGET_ID })
    ).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.ACCOUNT_NOT_ELIGIBLE
      })
    );

    expect(mockDataSource.transaction).not.toHaveBeenCalled();
  });

  it('should refuse to create a second owner', async () => {
    mockAdminAccountService.loadPromotableUser.mockRejectedValue(
      AuthorizationErrors.ownerImmutable('ROLE_CHANGE')
    );

    await expect(
      useCase.execute(OWNER_ID, { userId: TARGET_ID })
    ).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.OWNER_IMMUTABLE
      })
    );

    expect(mockUserRepository.updateRole).not.toHaveBeenCalled();
  });

  it('should refuse self-promotion', async () => {
    mockAdminAccountService.loadPromotableUser.mockRejectedValue(
      AuthorizationErrors.selfManagementForbidden('ROLE_CHANGE')
    );

    await expect(
      useCase.execute(OWNER_ID, { userId: OWNER_ID })
    ).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.SELF_MANAGEMENT_FORBIDDEN
      })
    );

    expect(mockUserRepository.updateRole).not.toHaveBeenCalled();
  });
});
