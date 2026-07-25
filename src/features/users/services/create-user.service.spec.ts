import { UserErrors } from '../errors/user-errors';
import { CreateUserService } from './create-user.service';

describe('CreateUserService', () => {
  let service: CreateUserService;

  const mockUserRepository = {
    create: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new CreateUserService(mockUserRepository as any);
  });

  describe('create', () => {
    it('should create user', async () => {
      mockUserRepository.create.mockResolvedValue(undefined);

      await service.create({
        email: 'test@test.com',
        username: 'test',
        password: 'hash'
      } as any);

      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should throw emailAlreadyExists', async () => {
      mockUserRepository.create.mockRejectedValue({
        code: '23505',
        detail: 'email'
      });

      await expect(service.create({} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should throw usernameAlreadyExists', async () => {
      mockUserRepository.create.mockRejectedValue({
        code: '23505',
        detail: 'username'
      });

      await expect(service.create({} as any)).rejects.toEqual(
        UserErrors.usernameAlreadyExists()
      );
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('unknown');
      mockUserRepository.create.mockRejectedValue(error);

      await expect(service.create({} as any)).rejects.toThrow(error);
    });
  });
});
