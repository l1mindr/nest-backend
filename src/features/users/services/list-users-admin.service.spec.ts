import { User } from '../entities/user.entity';
import { UserErrors } from '../errors/user-errors';
import { ListUsersAdminService } from './list-users-admin.service';

describe('ListUsersAdminService', () => {
  let service: ListUsersAdminService;

  const mockUserRepository = {
    findUsersForAdmin: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ListUsersAdminService(mockUserRepository as any);
  });

  describe('listUsers', () => {
    it('should return users with no nextCursor when all fit', async () => {
      const users = [{ id: '1' }, { id: '2' }] as User[];
      mockUserRepository.findUsersForAdmin.mockResolvedValue(users);

      const result = await service.listUsers();

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

      const result = await service.listUsers(undefined, 20);

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

      const result = await service.listUsers(cursor, 10);

      expect(result).toEqual({ items: users, nextCursor: null });
      expect(mockUserRepository.findUsersForAdmin).toHaveBeenCalledWith(
        cursorId,
        11
      );
    });

    it('should throw on invalid base64 cursor', async () => {
      await expect(service.listUsers('!!!invalid!!!')).rejects.toEqual(
        UserErrors.invalidCursor()
      );
    });

    it('should throw when cursor decodes to non-UUID value', async () => {
      const cursor = Buffer.from('not-a-uuid', 'utf-8').toString('base64url');

      await expect(service.listUsers(cursor)).rejects.toEqual(
        UserErrors.invalidCursor()
      );
    });

    it('should use default limit of 20 when limit is not provided', async () => {
      mockUserRepository.findUsersForAdmin.mockResolvedValue([]);

      await service.listUsers();

      expect(mockUserRepository.findUsersForAdmin).toHaveBeenCalledWith(
        null,
        21
      );
    });
  });
});
