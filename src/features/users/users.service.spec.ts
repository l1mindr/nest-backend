import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { UserErrors } from './errors/user-errors';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn()
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UsersService(mockDataSource as unknown as DataSource);
  });

  describe('findByIdentifierForAuth', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;

      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findByIdentifierForAuth('test@test.com');

      expect(result).toEqual(user);
    });
  });

  describe('findByIdForSessionValidation', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;

      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findByIdForSessionValidation('1');

      expect(result).toEqual(user);
    });
  });

  describe('findByIdWithPassword', () => {
    it('should return user', async () => {
      const user = {
        id: '1',
        password: 'hash'
      } as User;

      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findByIdWithPassword('1');

      expect(result).toEqual(user);
    });
  });

  describe('findById', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;

      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(result).toEqual(user);
    });

    it('should throw when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('1')).rejects.toEqual(
        UserErrors.userNotFound('1')
      );
    });
  });

  describe('setPassword', () => {
    it('should update password', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await service.setPassword('1', 'hashed-password');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: '1' },
        { password: 'hashed-password' }
      );
    });
  });

  describe('register', () => {
    it('should register user', async () => {
      const dto = {
        email: 'test@test.com'
      };

      mockRepository.create.mockReturnValue(dto);
      mockRepository.save.mockResolvedValue(undefined);

      await service.register(dto as any);

      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw emailAlreadyExists', async () => {
      mockRepository.create.mockReturnValue({});

      mockRepository.save.mockRejectedValue({
        code: '23505',
        detail: 'email'
      });

      await expect(service.register({} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should throw usernameAlreadyExists', async () => {
      mockRepository.create.mockReturnValue({});

      mockRepository.save.mockRejectedValue({
        code: '23505',
        detail: 'username'
      });

      await expect(service.register({} as any)).rejects.toEqual(
        UserErrors.usernameAlreadyExists()
      );
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('unknown');

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockRejectedValue(error);

      await expect(service.register({} as any)).rejects.toThrow(error);
    });
  });

  describe('list', () => {
    it('should return users', async () => {
      const users = [{ id: '1' }, { id: '2' }] as User[];

      mockRepository.find.mockResolvedValue(users);

      const result = await service.list();

      expect(result).toEqual(users);
    });
  });

  describe('updateProfile', () => {
    it('should update profile', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue({ id: '1' } as User);

      mockRepository.update.mockResolvedValue(undefined);

      await service.updateProfile('1', { name: 'Ali' } as any);

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: '1' },
        { name: 'Ali' }
      );
    });

    it('should throw emailAlreadyExists', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue({ id: '1' } as User);

      mockRepository.update.mockRejectedValue({
        code: '23505',
        detail: 'email'
      });

      await expect(service.updateProfile('1', {} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should throw usernameAlreadyExists', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue({ id: '1' } as User);

      mockRepository.update.mockRejectedValue({
        code: '23505',
        detail: 'username'
      });

      await expect(service.updateProfile('1', {} as any)).rejects.toEqual(
        UserErrors.usernameAlreadyExists()
      );
    });
  });

  describe('requestAccountDeletion', () => {
    it('should soft delete user', async () => {
      const user = { id: '1' } as User;

      jest.spyOn(service, 'findById').mockResolvedValue(user);

      await service.requestAccountDeletion('1');

      expect(mockRepository.softRemove).toHaveBeenCalledWith(user);
    });
  });
});
