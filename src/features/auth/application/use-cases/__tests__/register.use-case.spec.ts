import { Register } from '../register.use-case';

describe('Register', () => {
  let service: Register;

  const mockHashingProvider = {
    hash: jest.fn()
  };

  const mockCreateUserService = {
    create: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new Register(
      mockHashingProvider as any,
      mockCreateUserService as any
    );
  });

  describe('register', () => {
    it('should hash password and register user', async () => {
      mockHashingProvider.hash.mockResolvedValue('hashed-password');

      await service.register({
        email: 'test@test.com',
        password: '123456'
      } as any);

      expect(mockHashingProvider.hash).toHaveBeenCalledWith('123456');

      expect(mockCreateUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashed-password'
        })
      );
    });

    it('should propagate registration errors', async () => {
      const error = new Error('duplicate email');
      mockHashingProvider.hash.mockResolvedValue('hashed');
      mockCreateUserService.create.mockRejectedValue(error);

      await expect(
        service.register({
          email: 'test@test.com',
          password: '123456'
        } as any)
      ).rejects.toThrow(error);
    });
  });
});
