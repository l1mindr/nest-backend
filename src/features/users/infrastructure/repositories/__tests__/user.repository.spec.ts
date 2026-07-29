import { DataSource } from 'typeorm';
import { User } from '../../../domain/entities/user.entity';
import { UserRepository } from '../user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn()
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataSource.getRepository.mockReturnValue(mockRepository);

    repository = new UserRepository(mockDataSource as unknown as DataSource);
  });

  describe('insertUser', () => {
    it('should create and save user', async () => {
      const dto = {
        email: 'test@test.com',
        username: 'test',
        password: 'hash'
      };
      mockRepository.create.mockReturnValue(dto);
      mockRepository.save.mockResolvedValue(undefined);

      await repository.insertUser(dto as any);

      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('findUserById', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;
      mockRepository.findOne.mockResolvedValue(user);

      const result = await repository.findUserById('1');

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        select: { id: true }
      });
    });

    it('should return null when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findUserById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailOrUsernameForAuth', () => {
    it('should return user by email', async () => {
      const user = { id: '1', password: 'hash', status: 'ACTIVATE' } as User;
      mockRepository.findOne.mockResolvedValue(user);

      const result =
        await repository.findByEmailOrUsernameForAuth('test@test.com');

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: [{ email: 'test@test.com' }, { username: 'test@test.com' }],
        select: { id: true, email: true, password: true, status: true }
      });
    });

    it('should return null when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result =
        await repository.findByEmailOrUsernameForAuth('missing@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findUserWithPassword', () => {
    it('should return user with password', async () => {
      const user = { id: '1', password: 'hash' } as User;
      mockRepository.findOne.mockResolvedValue(user);

      const result = await repository.findUserWithPassword('1');

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        select: { id: true, password: true }
      });
    });
  });

  describe('findUserForAdmin', () => {
    it('should return user with admin view select', async () => {
      const user = { id: '1' } as User;
      mockRepository.findOne.mockResolvedValue(user);

      const result = await repository.findUserForAdmin('1');

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
  });

  describe('findUsersForAdmin', () => {
    it('should return users without cursor', async () => {
      const users = [{ id: '1' }, { id: '2' }] as User[];
      mockRepository.find.mockResolvedValue(users);

      const result = await repository.findUsersForAdmin(null, 21);

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
        },
        where: undefined,
        order: { id: 'ASC' },
        take: 21
      });
    });

    it('should apply cursor filter', async () => {
      const users = [{ id: '2' }] as User[];
      mockRepository.find.mockResolvedValue(users);

      const result = await repository.findUsersForAdmin('cursor-id', 11);

      expect(result).toEqual(users);
      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: expect.any(Object) }
        })
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should update user', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await repository.updateUserProfile('1', { name: 'Ali' } as any);

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: '1' },
        { name: 'Ali' }
      );
    });
  });
});
