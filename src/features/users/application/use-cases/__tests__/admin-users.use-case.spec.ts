import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { UserErrors } from '../../../domain/errors/user-errors';
import { AdminUsersUseCase } from '../../use-cases/admin-users.use-case';

describe('AdminUsersUseCase', () => {
  let service: AdminUsersUseCase;

  const mockUserRepository = {
    findUsersByRole: jest.fn(),
    findUserForAdmin: jest.fn()
  };

  const user = (overrides: Partial<User> = {}) =>
    ({ id: '1', role: UserRole.USER, ...overrides }) as User;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AdminUsersUseCase(mockUserRepository as any);
  });

  describe('list', () => {
    it('should return users with no nextCursor when all fit', async () => {
      const users = [user({ id: '1' }), user({ id: '2' })];
      mockUserRepository.findUsersByRole.mockResolvedValue(users);

      const result = await service.list();

      expect(result).toEqual({ items: users, nextCursor: null });
      expect(mockUserRepository.findUsersByRole).toHaveBeenCalledWith(
        UserRole.USER,
        null,
        21
      );
    });

    /**
     * The isolation rule, asserted at the query rather than on the result: the
     * listing asks only for `USER`, so administrators and the owner are absent
     * from the page, from `nextCursor` and from any count derived from it.
     * Filtering after the fact would leak all three.
     */
    it('should scope every listing to the user population', async () => {
      mockUserRepository.findUsersByRole.mockResolvedValue([]);

      await service.list();
      await service.list(undefined, 50);

      for (const call of mockUserRepository.findUsersByRole.mock.calls) {
        expect(call[0]).toBe(UserRole.USER);
      }
    });

    it('should return nextCursor when there are more results', async () => {
      const users = Array.from({ length: 21 }, (_, i) =>
        user({ id: `user-${String(i).padStart(2, '0')}` })
      );

      mockUserRepository.findUsersByRole.mockResolvedValue(users);

      const result = await service.list(undefined, 20);

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBe(
        Buffer.from('user-19', 'utf-8').toString('base64url')
      );
    });

    it('should apply cursor filter when cursor is provided', async () => {
      const cursorId = '550e8400-e29b-41d4-a716-446655440000';
      const cursor = Buffer.from(cursorId, 'utf-8').toString('base64url');
      const users = [user({ id: '660e8400-e29b-41d4-a716-446655440001' })];

      mockUserRepository.findUsersByRole.mockResolvedValue(users);

      const result = await service.list(cursor, 10);

      expect(result).toEqual({ items: users, nextCursor: null });
      expect(mockUserRepository.findUsersByRole).toHaveBeenCalledWith(
        UserRole.USER,
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
      mockUserRepository.findUsersByRole.mockResolvedValue([]);

      await service.list();

      expect(mockUserRepository.findUsersByRole).toHaveBeenCalledWith(
        UserRole.USER,
        null,
        21
      );
    });
  });

  describe('findById', () => {
    it('should return user', async () => {
      const target = user();
      mockUserRepository.findUserForAdmin.mockResolvedValue(target);

      const result = await service.findById('1');

      expect(result).toEqual(target);
      expect(mockUserRepository.findUserForAdmin).toHaveBeenCalledWith('1');
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toEqual(
        UserErrors.userNotFound('missing')
      );
    });

    /**
     * A privileged account answers exactly as an unused identifier does. A
     * `403` here would confirm the identifier belongs to an administrator or
     * the owner, which is the answer an enumeration attempt is fishing for.
     */
    it.each([UserRole.ADMIN, UserRole.OWNER])(
      'should answer NOT_FOUND for a %s account',
      async (role) => {
        mockUserRepository.findUserForAdmin.mockResolvedValue(
          user({ id: 'privileged', role })
        );

        await expect(service.findById('privileged')).rejects.toEqual(
          UserErrors.userNotFound('privileged')
        );
      }
    );

    it('should answer identically whether the account is absent or privileged', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(null);
      const absent = await service.findById('x').catch((e: unknown) => e);

      mockUserRepository.findUserForAdmin.mockResolvedValue(
        user({ id: 'x', role: UserRole.OWNER })
      );
      const owner = await service.findById('x').catch((e: unknown) => e);

      expect(JSON.stringify(owner)).toEqual(JSON.stringify(absent));
    });
  });
});
