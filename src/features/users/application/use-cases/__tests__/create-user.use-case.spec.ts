import { UserErrors } from '../../../errors/user-errors';
import { CreateUserUseCase } from '../../use-cases/create-user.use-case';

describe('CreateUserUseCase', () => {
  let service: CreateUserUseCase;

  const mockUserRepository = {
    insertUser: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new CreateUserUseCase(mockUserRepository as any);
  });

  describe('execute', () => {
    it('should create user', async () => {
      mockUserRepository.insertUser.mockResolvedValue(undefined);

      await service.execute({
        email: 'test@test.com',
        username: 'test',
        password: 'hash'
      } as any);

      expect(mockUserRepository.insertUser).toHaveBeenCalled();
    });

    it('should throw emailAlreadyExists', async () => {
      mockUserRepository.insertUser.mockRejectedValue({
        code: '23505',
        detail: 'email'
      });

      await expect(service.execute({} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should throw usernameAlreadyExists', async () => {
      mockUserRepository.insertUser.mockRejectedValue({
        code: '23505',
        detail: 'username'
      });

      await expect(service.execute({} as any)).rejects.toEqual(
        UserErrors.usernameAlreadyExists()
      );
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('unknown');
      mockUserRepository.insertUser.mockRejectedValue(error);

      await expect(service.execute({} as any)).rejects.toThrow(error);
    });
  });
});
