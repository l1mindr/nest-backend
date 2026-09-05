import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserErrorCode } from '@features/users/domain/errors/user-error-code.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { UnassignRoleUseCase } from '../unassign-role.use-case';

describe('UnassignRoleUseCase', () => {
  let useCase: UnassignRoleUseCase;

  const mockUserRepository = { findUserForAdmin: jest.fn() };
  const mockUserRoleRepository = { unassign: jest.fn() };
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

    useCase = new UnassignRoleUseCase(
      mockUserRepository as any,
      mockUserRoleRepository as any,
      mockLogger as any
    );
  });

  it('should remove the role', async () => {
    await useCase.execute(owner, TARGET_ID, ROLE_ID);

    expect(mockUserRoleRepository.unassign).toHaveBeenCalledWith(
      TARGET_ID,
      ROLE_ID
    );
  });

  it('should refuse an unknown account', async () => {
    mockUserRepository.findUserForAdmin.mockResolvedValue(null);

    await expect(useCase.execute(owner, 'missing', ROLE_ID)).rejects.toThrow(
      expect.objectContaining({ code: UserErrorCode.USER_NOT_FOUND })
    );

    expect(mockUserRoleRepository.unassign).not.toHaveBeenCalled();
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

    expect(mockUserRoleRepository.unassign).not.toHaveBeenCalled();
  });

  it('should refuse self-unassignment', async () => {
    mockUserRepository.findUserForAdmin.mockResolvedValue({
      id: owner.id,
      role: UserRole.ADMIN
    });

    await expect(useCase.execute(owner, owner.id, ROLE_ID)).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.SELF_MANAGEMENT_FORBIDDEN
      })
    );
  });
});
