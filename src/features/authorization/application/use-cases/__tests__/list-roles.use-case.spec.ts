import { Permission } from '../../../domain/enums/permission.enum';
import { ListRolesUseCase } from '../list-roles.use-case';

describe('ListRolesUseCase', () => {
  let useCase: ListRolesUseCase;

  const mockRoleRepository = {
    findAll: jest.fn(),
    permissionsOf: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListRolesUseCase(mockRoleRepository as any);
  });

  it('should attach permissions to every role', async () => {
    mockRoleRepository.findAll.mockResolvedValue([
      { id: 'role-1', name: 'SUPPORT' },
      { id: 'role-2', name: 'READ_ONLY' }
    ]);
    mockRoleRepository.permissionsOf.mockImplementation((roleId: string) =>
      Promise.resolve(
        roleId === 'role-1'
          ? [Permission.USER_READ, Permission.USER_UPDATE]
          : []
      )
    );

    const result = await useCase.execute();

    expect(result).toEqual([
      {
        role: { id: 'role-1', name: 'SUPPORT' },
        permissions: [Permission.USER_READ, Permission.USER_UPDATE]
      },
      { role: { id: 'role-2', name: 'READ_ONLY' }, permissions: [] }
    ]);
  });
});
