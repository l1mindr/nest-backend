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

    it('should refuse the owner as a target', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ role: UserRole.OWNER })
      );

      await expect(
        service.loadManageableAdmin(
          ACTOR_ID,
          'target-1',
          ProtectedAction.ROLE_CHANGE
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.OWNER_IMMUTABLE
        })
      );
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

    it('should refuse a target that is not an administrator', async () => {
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
          code: AuthorizationErrorCode.NOT_AN_ADMINISTRATOR,
          statusCode: 409
        })
      );
    });

    it('should check the owner before the role, so the owner never reads as a non-administrator', async () => {
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
          code: AuthorizationErrorCode.OWNER_IMMUTABLE
        })
      );
    });
  });

  describe('loadPromotableUser', () => {
    it('should return an active ordinary account', async () => {
      const target = account({ role: UserRole.USER });
      mockUserRepository.findUserForAdmin.mockResolvedValue(target);

      await expect(
        service.loadPromotableUser(ACTOR_ID, 'target-1')
      ).resolves.toBe(target);
    });

    it('should refuse an account that is already an administrator', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ role: UserRole.ADMIN })
      );

      await expect(
        service.loadPromotableUser(ACTOR_ID, 'target-1')
      ).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.ALREADY_AN_ADMINISTRATOR,
          statusCode: 409
        })
      );
    });

    it('should refuse the owner, so a second owner cannot be created', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ role: UserRole.OWNER })
      );

      await expect(
        service.loadPromotableUser(ACTOR_ID, 'target-1')
      ).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.OWNER_IMMUTABLE
        })
      );
    });

    it('should refuse self-promotion', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ id: ACTOR_ID, role: UserRole.USER })
      );

      await expect(
        service.loadPromotableUser(ACTOR_ID, ACTOR_ID)
      ).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.SELF_MANAGEMENT_FORBIDDEN
        })
      );
    });

    it.each([
      UserStatus.PENDING_VERIFICATION,
      UserStatus.SUSPEND,
      UserStatus.DEACTIVATE
    ])('should refuse to promote a %s account', async (status) => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(
        account({ role: UserRole.USER, status })
      );

      await expect(
        service.loadPromotableUser(ACTOR_ID, 'target-1')
      ).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.ACCOUNT_NOT_ELIGIBLE,
          statusCode: 409,
          metadata: { status }
        })
      );
    });
  });
});
