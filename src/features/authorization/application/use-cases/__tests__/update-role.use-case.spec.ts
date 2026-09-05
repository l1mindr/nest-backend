import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { UpdateRoleUseCase } from '../update-role.use-case';

describe('UpdateRoleUseCase', () => {
  let useCase: UpdateRoleUseCase;

  const mockRoleRepository = {
    findById: jest.fn(),
    update: jest.fn()
  };

  const mockLogger = { setContext: jest.fn(), info: jest.fn() };

  const customRole = {
    id: 'role-1',
    name: 'SUPPORT',
    description: '',
    isSystem: false
  };
  const systemRole = {
    id: 'role-owner',
    name: 'OWNER',
    description: '',
    isSystem: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateRoleUseCase(
      mockRoleRepository as any,
      mockLogger as any
    );
  });

  it('should rename a custom role', async () => {
    mockRoleRepository.findById.mockResolvedValue(customRole);

    await useCase.execute('role-1', { name: 'SUPPORT_L1' });

    expect(mockRoleRepository.update).toHaveBeenCalledWith('role-1', {
      name: 'SUPPORT_L1'
    });
  });

  it('should refuse an unknown role', async () => {
    mockRoleRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', { name: 'X' })).rejects.toThrow(
      expect.objectContaining({ code: AuthorizationErrorCode.ROLE_NOT_FOUND })
    );
  });

  it('should refuse to rename a system role', async () => {
    mockRoleRepository.findById.mockResolvedValue(systemRole);

    await expect(
      useCase.execute('role-owner', { name: 'NOT_OWNER' })
    ).rejects.toThrow(
      expect.objectContaining({ code: AuthorizationErrorCode.ROLE_PROTECTED })
    );

    expect(mockRoleRepository.update).not.toHaveBeenCalled();
  });

  it('should translate a race-lost unique violation on rename', async () => {
    mockRoleRepository.findById.mockResolvedValue(customRole);
    mockRoleRepository.update.mockRejectedValue({ code: '23505' });

    await expect(useCase.execute('role-1', { name: 'TAKEN' })).rejects.toThrow(
      expect.objectContaining({
        code: AuthorizationErrorCode.ROLE_NAME_CONFLICT
      })
    );
  });
});
