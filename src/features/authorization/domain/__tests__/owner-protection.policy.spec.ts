import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { AuthorizationErrorCode } from '../errors/authorization-error-code.enum';
import {
  OwnerProtectionPolicy,
  ProtectedAction
} from '../owner-protection.policy';

describe('OwnerProtectionPolicy', () => {
  const owner = { id: 'owner-1', role: UserRole.OWNER };
  const admin = { id: 'admin-1', role: UserRole.ADMIN };
  const user = { id: 'user-1', role: UserRole.USER };

  describe('assertNotOwner', () => {
    it.each([
      ProtectedAction.SUSPEND,
      ProtectedAction.UNSUSPEND,
      ProtectedAction.DELETE,
      ProtectedAction.STATUS_CHANGE,
      ProtectedAction.ROLE_CHANGE,
      ProtectedAction.PROFILE_UPDATE,
      ProtectedAction.PERMISSION_GRANT,
      ProtectedAction.PERMISSION_REVOKE
    ])('should refuse %s against the owner', (action) => {
      expect(() => OwnerProtectionPolicy.assertNotOwner(owner, action)).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.OWNER_IMMUTABLE,
          statusCode: 403
        })
      );
    });

    it('should report which action was refused', () => {
      expect(() =>
        OwnerProtectionPolicy.assertNotOwner(owner, ProtectedAction.SUSPEND)
      ).toThrow(
        expect.objectContaining({
          metadata: { action: ProtectedAction.SUSPEND }
        })
      );
    });

    it('should allow the action against an administrator or a user', () => {
      expect(() =>
        OwnerProtectionPolicy.assertNotOwner(admin, ProtectedAction.SUSPEND)
      ).not.toThrow();
      expect(() =>
        OwnerProtectionPolicy.assertNotOwner(user, ProtectedAction.SUSPEND)
      ).not.toThrow();
    });
  });

  describe('assertDeletable', () => {
    it('should refuse to delete the owner', () => {
      expect(() => OwnerProtectionPolicy.assertDeletable(owner)).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.OWNER_IMMUTABLE,
          metadata: { action: ProtectedAction.DELETE }
        })
      );
    });

    it('should allow any other account to be deleted', () => {
      expect(() => OwnerProtectionPolicy.assertDeletable(user)).not.toThrow();
      expect(() => OwnerProtectionPolicy.assertDeletable(admin)).not.toThrow();
    });
  });

  describe('assertRoleAssignable', () => {
    it('should refuse to assign OWNER', () => {
      expect(() =>
        OwnerProtectionPolicy.assertRoleAssignable(UserRole.OWNER)
      ).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.OWNER_ROLE_NOT_ASSIGNABLE,
          statusCode: 403
        })
      );
    });

    it('should allow the assignable tiers', () => {
      expect(() =>
        OwnerProtectionPolicy.assertRoleAssignable(UserRole.ADMIN)
      ).not.toThrow();
      expect(() =>
        OwnerProtectionPolicy.assertRoleAssignable(UserRole.USER)
      ).not.toThrow();
    });
  });

  describe('assertNotSelf', () => {
    it('should refuse a caller aiming at their own account', () => {
      expect(() =>
        OwnerProtectionPolicy.assertNotSelf(
          admin.id,
          admin.id,
          ProtectedAction.PERMISSION_GRANT
        )
      ).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.SELF_MANAGEMENT_FORBIDDEN,
          statusCode: 403,
          metadata: { action: ProtectedAction.PERMISSION_GRANT }
        })
      );
    });

    it('should allow a caller aiming at somebody else', () => {
      expect(() =>
        OwnerProtectionPolicy.assertNotSelf(
          admin.id,
          'admin-2',
          ProtectedAction.PERMISSION_GRANT
        )
      ).not.toThrow();
    });
  });
});
