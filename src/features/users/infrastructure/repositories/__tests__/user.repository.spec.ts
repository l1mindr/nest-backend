import { DataSource } from 'typeorm';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { UserStatus } from '../../../domain/enums/user-status.enum';
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
      // `role` travels with the identifier so that the callers using this as an
      // existence check can also refuse to act on the owner, without a second
      // query for a single column.
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        select: { id: true, role: true }
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
        select: {
          id: true,
          email: true,
          password: true,
          status: true,
          registryDates: { createdAt: true }
        }
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
          registryDates: { createdAt: true, updatedAt: true, deletedAt: true }
        }
      });
    });
  });

  describe('findUsersByRole', () => {
    it('should scope the listing to the requested role', async () => {
      const users = [{ id: '1' }, { id: '2' }] as User[];
      mockRepository.find.mockResolvedValue(users);

      const result = await repository.findUsersByRole(UserRole.USER, null, 21);

      expect(result).toEqual(users);
      expect(mockRepository.find).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          status: true,
          registryDates: { createdAt: true, updatedAt: true, deletedAt: true }
        },
        where: { role: UserRole.USER },
        order: { id: 'ASC' },
        take: 21
      });
    });

    it('should apply cursor filter alongside the role', async () => {
      const users = [{ id: '2' }] as User[];
      mockRepository.find.mockResolvedValue(users);

      const result = await repository.findUsersByRole(
        UserRole.ADMIN,
        'cursor-id',
        11
      );

      expect(result).toEqual(users);
      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: UserRole.ADMIN, id: expect.any(Object) }
        })
      );
    });

    /**
     * The owner is excluded by never being asked for, rather than by being
     * filtered out of a wider result. A listing that fetched every account and
     * removed the owner afterwards would leak through counts and pagination.
     */
    it.each([UserRole.USER, UserRole.ADMIN])(
      'should never query without a role filter (%s)',
      async (role) => {
        mockRepository.find.mockResolvedValue([]);

        await repository.findUsersByRole(role, null, 10);

        expect(mockRepository.find).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ role }) })
        );
      }
    );
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

  describe('findPendingOlderThan', () => {
    it('should find pending users older than cutoff', async () => {
      const cutoff = new Date('2024-01-01T00:00:00Z');
      const users = [{ id: '1' }, { id: '2' }] as User[];
      mockRepository.find.mockResolvedValue(users);

      const result = await repository.findPendingOlderThan(cutoff);

      expect(result).toEqual(users);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          status: UserStatus.PENDING_VERIFICATION,
          registryDates: { createdAt: expect.any(Object) }
        },
        select: {
          id: true,
          email: true,
          status: true,
          registryDates: { createdAt: true }
        }
      });
    });
  });
});
