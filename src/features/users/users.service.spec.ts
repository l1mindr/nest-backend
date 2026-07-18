import { DataSource, EntityManager } from 'typeorm';
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

    it('should use the transaction manager repository when provided', async () => {
      const transactionRepository = {
        update: jest.fn().mockResolvedValue(undefined)
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionRepository)
      } as unknown as EntityManager;

      await service.setPassword('1', 'hashed-password', manager);

      expect(manager.getRepository).toHaveBeenCalledWith(User);
      expect(transactionRepository.update).toHaveBeenCalledWith(
        { id: '1' },
        { password: 'hashed-password' }
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
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

  describe('listForAdmin', () => {
    it('should return users with the admin view selection', async () => {
      const users = [{ id: '1' }, { id: '2' }] as User[];

      mockRepository.find.mockResolvedValue(users);

      const result = await service.listForAdmin();

      expect(result).toEqual(users);
      expect(mockRepository.find).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          status: true,
          registryDates: { createdAt: true, updatedAt: true, deleteAt: true }
        }
      });
    });
  });

  describe('findByIdForAdmin', () => {
    it('should return user with the admin view selection', async () => {
      const user = { id: '1' } as User;

      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findByIdForAdmin('1');

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          status: true,
          registryDates: { createdAt: true, updatedAt: true, deleteAt: true }
        }
      });
    });

    it('should throw when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdForAdmin('missing')).rejects.toEqual(
        UserErrors.userNotFound('missing')
      );
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
