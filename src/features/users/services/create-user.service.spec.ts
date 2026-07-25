import { UserErrors } from '../errors/user-errors';
import { CreateUserService } from './create-user.service';

describe('CreateUserService', () => {
  let service: CreateUserService;

  const mockUserRepository = {
    insertUser: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new CreateUserService(mockUserRepository as any);
  });

  describe('createUser', () => {
    it('should create user', async () => {
      mockUserRepository.insertUser.mockResolvedValue(undefined);

      await service.createUser({
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

      await expect(service.createUser({} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should throw usernameAlreadyExists', async () => {
      mockUserRepository.insertUser.mockRejectedValue({
        code: '23505',
        detail: 'username'
      });

      await expect(service.createUser({} as any)).rejects.toEqual(
        UserErrors.usernameAlreadyExists()
      );
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('unknown');
      mockUserRepository.insertUser.mockRejectedValue(error);

      await expect(service.createUser({} as any)).rejects.toThrow(error);
    });
  });
});
