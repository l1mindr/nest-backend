import { ISessionsService } from '@features/sessions/interfaces/sessions.interface';
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

  const mockTransactionManager = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository),
    transaction: jest.fn(
      async (cb: (manager: EntityManager) => Promise<unknown>) =>
        cb(mockTransactionManager as unknown as EntityManager)
    )
  };

  const mockSessionsService = {
    revokeAllForUser: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataSource.getRepository.mockReturnValue(mockRepository);
    mockTransactionManager.getRepository.mockReturnValue(mockRepository);

    service = new UsersService(
      mockDataSource as unknown as DataSource,
      mockSessionsService as unknown as ISessionsService
    );
  });

  describe('findByIdentifierForAuth', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;

      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findByIdentifierForAuth('test@test.com');

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
    it('should return users with the admin view selection and no nextCursor when all fit', async () => {
      const users = [{ id: '1' }, { id: '2' }] as User[];

      mockRepository.find.mockResolvedValue(users);

      const result = await service.listForAdmin();

      expect(result).toEqual({ items: users, nextCursor: null });
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

    it('should return nextCursor when there are more results', async () => {
      const users = Array.from({ length: 21 }, (_, i) => ({
        id: `user-${String(i).padStart(2, '0')}`
      })) as User[];

      mockRepository.find.mockResolvedValue(users);

      const result = await service.listForAdmin(undefined, 20);

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBe(
        Buffer.from('user-19', 'utf-8').toString('base64url')
      );
    });

    it('should apply cursor filter when cursor is provided', async () => {
      const cursorId = '550e8400-e29b-41d4-a716-446655440000';
      const cursor = Buffer.from(cursorId, 'utf-8').toString('base64url');
      const users = [{ id: '660e8400-e29b-41d4-a716-446655440001' }] as User[];

      mockRepository.find.mockResolvedValue(users);

      const result = await service.listForAdmin(cursor, 10);

      expect(result).toEqual({ items: users, nextCursor: null });
      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: expect.any(Object) },
          take: 11
        })
      );
    });

    it('should throw on invalid base64 cursor', async () => {
      await expect(service.listForAdmin('!!!invalid!!!')).rejects.toEqual(
        UserErrors.invalidCursor()
      );
    });

    it('should throw when cursor decodes to non-UUID value', async () => {
      const cursor = Buffer.from('not-a-uuid', 'utf-8').toString('base64url');

      await expect(service.listForAdmin(cursor)).rejects.toEqual(
        UserErrors.invalidCursor()
      );
    });

    it('should use default limit of 20 when limit is not provided', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.listForAdmin();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 })
      );
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
    it('should soft delete user and revoke all sessions in one transaction', async () => {
      const user = { id: '1' } as User;

      jest.spyOn(service, 'findById').mockResolvedValue(user);

      await service.requestAccountDeletion('1');

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepository.softRemove).toHaveBeenCalledWith(user);
      expect(mockSessionsService.revokeAllForUser).toHaveBeenCalledWith(
        '1',
        mockTransactionManager
      );
    });

    it('should not revoke sessions when the user does not exist', async () => {
      jest
        .spyOn(service, 'findById')
        .mockRejectedValue(UserErrors.userNotFound('1'));

      await expect(service.requestAccountDeletion('1')).rejects.toEqual(
        UserErrors.userNotFound('1')
      );

      expect(mockRepository.softRemove).not.toHaveBeenCalled();
      expect(mockSessionsService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('should propagate transaction failures without swallowing them', async () => {
      const user = { id: '1' } as User;
      const error = new Error('db down');

      jest.spyOn(service, 'findById').mockResolvedValue(user);
      mockRepository.softRemove.mockRejectedValue(error);

      await expect(service.requestAccountDeletion('1')).rejects.toThrow(error);
    });
  });
});
