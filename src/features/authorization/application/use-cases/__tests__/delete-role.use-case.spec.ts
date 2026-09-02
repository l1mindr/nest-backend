import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { DeleteRoleUseCase } from '../delete-role.use-case';

describe('DeleteRoleUseCase', () => {
  let useCase: DeleteRoleUseCase;

  const mockRoleRepository = {
    findById: jest.fn(),
    delete: jest.fn()
  };

  const mockUserRoleRepository = {
    countAssignments: jest.fn()
  };

  const mockLogger = { setContext: jest.fn(), info: jest.fn() };

  const customRole = {
    id: 'role-1',
    name: 'SUPPORT',
    description: '',
    isSystem: false
  };
  const systemRole = {
    id: 'role-user',
    name: 'USER',
    description: '',
    isSystem: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRoleRepository.countAssignments.mockResolvedValue(0);

    useCase = new DeleteRoleUseCase(
      mockRoleRepository as any,
      mockUserRoleRepository as any,
      mockLogger as any
    );
  });

  it('should delete a custom role with no assignments', async () => {
    mockRoleRepository.findById.mockResolvedValue(customRole);

    await useCase.execute('role-1');

    expect(mockRoleRepository.delete).toHaveBeenCalledWith('role-1');
  });

  it('should refuse an unknown role', async () => {
    mockRoleRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(
      expect.objectContaining({ code: AuthorizationErrorCode.ROLE_NOT_FOUND })
    );
  });

  it('should refuse to delete a system role', async () => {
    mockRoleRepository.findById.mockResolvedValue(systemRole);

    await expect(useCase.execute('role-user')).rejects.toThrow(
      expect.objectContaining({ code: AuthorizationErrorCode.ROLE_PROTECTED })
    );

    expect(mockRoleRepository.delete).not.toHaveBeenCalled();
  });

  it('should refuse to delete a role with active assignments', async () => {
    mockRoleRepository.findById.mockResolvedValue(customRole);
    mockUserRoleRepository.countAssignments.mockResolvedValue(2);

    await expect(useCase.execute('role-1')).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.ROLE_HAS_ASSIGNMENTS
      })
    );

    expect(mockRoleRepository.delete).not.toHaveBeenCalled();
  });
});
