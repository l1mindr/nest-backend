import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { UserErrorCode } from '@features/users/domain/errors/user-error-code.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { ProtectedAction } from '../../../domain/owner-protection.policy';
import { AdminAccountService } from '../admin-account.service';

describe('AdminAccountService', () => {
  let service: AdminAccountService;

  const mockUserRepository = {
    findUserForAdmin: jest.fn()
  };

  const ACTOR_ID = 'actor-1';

  const account = (overrides: Record<string, unknown> = {}) => ({
    id: 'target-1',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVATE,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminAccountService(mockUserRepository as any);
  });

  describe('loadManageableAdmin', () => {
    it('should return the administrator when every precondition holds', async () => {
      const target = account();
      mockUserRepository.findUserForAdmin.mockResolvedValue(target);

      await expect(
        service.loadManageableAdmin(
          ACTOR_ID,
          'target-1',
          ProtectedAction.PERMISSION_GRANT
        )
      ).resolves.toBe(target);
    });

    it('should raise USER_NOT_FOUND for an unknown account', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(null);

      await expect(
        service.loadManageableAdmin(
          ACTOR_ID,
          'missing',
          ProtectedAction.PERMISSION_GRANT
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: UserErrorCode.USER_NOT_FOUND,
          statusCode: 404
        })
      );
    });

    /**
     * The owner must be indistinguishable from an identifier that was never
     * issued. A dedicated refusal would confirm the account exists and that it
     * is the owner, which is precisely what an enumeration attempt wants.
     */
    it('should answer NOT_FOUND rather than a distinct refusal for the owner', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ role: UserRole.OWNER })
      );

      await expect(
        service.loadManageableAdmin(
          ACTOR_ID,
          'target-1',
          ProtectedAction.SUSPEND
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: UserErrorCode.USER_NOT_FOUND,
          statusCode: 404
        })
      );
    });

    it('should not leak that the target is the owner through the error metadata', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ role: UserRole.OWNER })
      );

      const error = await service
        .loadManageableAdmin(ACTOR_ID, 'target-1', ProtectedAction.DELETE)
        .catch((caught: unknown) => caught);

      expect(JSON.stringify(error)).not.toContain(UserRole.OWNER);
    });

    it('should refuse a caller aiming at their own account', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ id: ACTOR_ID })
      );

      await expect(
        service.loadManageableAdmin(
          ACTOR_ID,
          ACTOR_ID,
          ProtectedAction.PERMISSION_GRANT
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.SELF_MANAGEMENT_FORBIDDEN
        })
      );
    });

    /** An ordinary user is administered through the user endpoints, not here. */
    it('should answer NOT_FOUND for an ordinary user', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ role: UserRole.USER })
      );

      await expect(
        service.loadManageableAdmin(
          ACTOR_ID,
          'target-1',
          ProtectedAction.PERMISSION_GRANT
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: UserErrorCode.USER_NOT_FOUND,
          statusCode: 404
        })
      );
    });

    /**
     * Population before identity: an owner aiming at themselves must still read
     * as absent rather than as a self-management refusal, which would confirm
     * the caller is the owner to anyone who stole a session.
     */
    it('should check the population before self-targeting', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ id: ACTOR_ID, role: UserRole.OWNER })
      );

      await expect(
        service.loadManageableAdmin(
          ACTOR_ID,
          ACTOR_ID,
          ProtectedAction.STATUS_CHANGE
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: UserErrorCode.USER_NOT_FOUND
        })
      );
    });
  });
});
