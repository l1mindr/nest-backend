import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { Permission } from '../../../domain/enums/permission.enum';
import { GetRoleUseCase } from '../get-role.use-case';

describe('GetRoleUseCase', () => {
  let useCase: GetRoleUseCase;

  const mockRoleRepository = {
    findById: jest.fn(),
    permissionsOf: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetRoleUseCase(mockRoleRepository as any);
  });

  it('should return the role with its permissions', async () => {
    mockRoleRepository.findById.mockResolvedValue({
      id: 'role-1',
      name: 'SUPPORT'
    });
    mockRoleRepository.permissionsOf.mockResolvedValue([Permission.USER_READ]);

    const result = await useCase.execute('role-1');

    expect(result).toEqual({
      role: { id: 'role-1', name: 'SUPPORT' },
      permissions: [Permission.USER_READ]
    });
  });

  it('should refuse an unknown role', async () => {
    mockRoleRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(
      expect.objectContaining({ code: AuthorizationErrorCode.ROLE_NOT_FOUND })
    );
  });
});
