import { UserErrorCode } from '@features/users/domain/errors/user-error-code.enum';
import { Permission } from '../../../domain/enums/permission.enum';
import { ListUserRolesUseCase } from '../list-user-roles.use-case';

describe('ListUserRolesUseCase', () => {
  let useCase: ListUserRolesUseCase;

  const mockUserRepository = { findUserForAdmin: jest.fn() };
  const mockUserRoleRepository = { rolesForUser: jest.fn() };
  const mockRoleRepository = { permissionsOf: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository.findUserForAdmin.mockResolvedValue({ id: 'user-1' });

    useCase = new ListUserRolesUseCase(
      mockUserRepository as any,
      mockUserRoleRepository as any,
      mockRoleRepository as any
    );
  });

  it('should return the roles assigned to the account, with permissions', async () => {
    mockUserRoleRepository.rolesForUser.mockResolvedValue([
      { id: 'role-1', name: 'SUPPORT' }
    ]);
    mockRoleRepository.permissionsOf.mockResolvedValue([Permission.USER_READ]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([
      {
        role: { id: 'role-1', name: 'SUPPORT' },
        permissions: [Permission.USER_READ]
      }
    ]);
  });

  it('should refuse an unknown account', async () => {
    mockUserRepository.findUserForAdmin.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(
      expect.objectContaining({ code: UserErrorCode.USER_NOT_FOUND })
    );
  });
});
