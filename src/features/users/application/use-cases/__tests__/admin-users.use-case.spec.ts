import { User } from '../../../domain/entities/user.entity';
import { UserErrors } from '../../../domain/errors/user-errors';
import { AdminUsersUseCase } from '../../use-cases/admin-users.use-case';

describe('AdminUsersUseCase', () => {
  let service: AdminUsersUseCase;

  const mockUserRepository = {
    findUsersForAdmin: jest.fn(),
    findUserForAdmin: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AdminUsersUseCase(mockUserRepository as any);
  });

  describe('list', () => {
    it('should return users with no nextCursor when all fit', async () => {
      const users = [{ id: '1' }, { id: '2' }] as User[];
      mockUserRepository.findUsersForAdmin.mockResolvedValue(users);

      const result = await service.list();

      expect(result).toEqual({ items: users, nextCursor: null });
      expect(mockUserRepository.findUsersForAdmin).toHaveBeenCalledWith(
        null,
        21
      );
    });

    it('should return nextCursor when there are more results', async () => {
      const users = Array.from({ length: 21 }, (_, i) => ({
        id: `user-${String(i).padStart(2, '0')}`
      })) as User[];

      mockUserRepository.findUsersForAdmin.mockResolvedValue(users);

      const result = await service.list(undefined, 20);

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBe(
        Buffer.from('user-19', 'utf-8').toString('base64url')
      );
    });

    it('should apply cursor filter when cursor is provided', async () => {
      const cursorId = '550e8400-e29b-41d4-a716-446655440000';
      const cursor = Buffer.from(cursorId, 'utf-8').toString('base64url');
      const users = [{ id: '660e8400-e29b-41d4-a716-446655440001' }] as User[];

      mockUserRepository.findUsersForAdmin.mockResolvedValue(users);

      const result = await service.list(cursor, 10);

      expect(result).toEqual({ items: users, nextCursor: null });
      expect(mockUserRepository.findUsersForAdmin).toHaveBeenCalledWith(
        cursorId,
        11
      );
    });

    it('should throw on invalid base64 cursor', async () => {
      await expect(service.list('!!!invalid!!!')).rejects.toEqual(
        UserErrors.invalidCursor()
      );
    });

    it('should throw when cursor decodes to non-UUID value', async () => {
      const cursor = Buffer.from('not-a-uuid', 'utf-8').toString('base64url');

      await expect(service.list(cursor)).rejects.toEqual(
        UserErrors.invalidCursor()
      );
    });

    it('should use default limit of 20 when limit is not provided', async () => {
      mockUserRepository.findUsersForAdmin.mockResolvedValue([]);

      await service.list();

      expect(mockUserRepository.findUsersForAdmin).toHaveBeenCalledWith(
        null,
        21
      );
    });
  });

  describe('findById', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;
      mockUserRepository.findUserForAdmin.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(result).toEqual(user);
      expect(mockUserRepository.findUserForAdmin).toHaveBeenCalledWith('1');
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toEqual(
        UserErrors.userNotFound('missing')
      );
    });
  });
});
