import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { CreateRoleUseCase } from '../create-role.use-case';

describe('CreateRoleUseCase', () => {
  let useCase: CreateRoleUseCase;

  const mockRoleRepository = {
    findByName: jest.fn(),
    create: jest.fn()
  };

  const mockLogger = { setContext: jest.fn(), info: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoleRepository.findByName.mockResolvedValue(null);
    mockRoleRepository.create.mockResolvedValue({
      id: 'role-1',
      name: 'SUPPORT',
      description: '',
      isSystem: false
    });

    useCase = new CreateRoleUseCase(
      mockRoleRepository as any,
      mockLogger as any
    );
  });

  it('should create a role with no permissions', async () => {
    const role = await useCase.execute({ name: 'SUPPORT' });

    expect(mockRoleRepository.create).toHaveBeenCalledWith({
      name: 'SUPPORT',
      description: ''
    });
    expect(role.id).toBe('role-1');
  });

  it('should refuse a duplicate name', async () => {
    mockRoleRepository.findByName.mockResolvedValue({ id: 'existing' });

    await expect(useCase.execute({ name: 'SUPPORT' })).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.ROLE_NAME_CONFLICT
      })
    );

    expect(mockRoleRepository.create).not.toHaveBeenCalled();
  });

  it('should translate a race-lost unique violation into the same conflict', async () => {
    mockRoleRepository.create.mockRejectedValue({ code: '23505' });

    await expect(useCase.execute({ name: 'SUPPORT' })).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.ROLE_NAME_CONFLICT
      })
    );
  });
});
