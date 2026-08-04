import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { AuthorizationErrors } from './errors/authorization-errors';
import { RoleHierarchy } from './role-hierarchy';

/**
 * Operations the owner is shielded from. Named so the refusal reported to the
 * client says which invariant was hit, and so no call site has to invent a
 * string of its own.
 */
export const ProtectedAction = {
  SUSPEND: 'SUSPEND',
  UNSUSPEND: 'UNSUSPEND',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  PERMISSION_GRANT: 'PERMISSION_GRANT',
  PERMISSION_REVOKE: 'PERMISSION_REVOKE'
} as const;

export type ProtectedAction =
  (typeof ProtectedAction)[keyof typeof ProtectedAction];

/** The minimum an account has to expose for the policy to judge it. */
export interface ProtectedAccount {
  readonly id: string;
  readonly role: UserRole;
}

/**
 * The owner invariants, in one place.
 *
 * The rules are asserted by the use cases that would otherwise violate them
 * rather than by a guard, because they concern *which resource* is being acted
 * on — knowledge a guard does not have without loading it. Every assertion is
 * therefore a precondition of the operation, checked before any write.
 *
 * Uniqueness of the owner is additionally enforced by a partial unique index on
 * `user(role) WHERE role = 'OWNER'`, so a race between two promotions cannot
 * produce a second owner even if it slips past these checks.
 */
export class OwnerProtectionPolicy {
  /**
   * Refuses any administrative operation aimed at the owner. Self-service flows
   * (profile update, password change, email verification) do not call this —
   * the owner is an ordinary account to themselves.
   */
  static assertNotOwner(
    account: ProtectedAccount,
    action: ProtectedAction
  ): void {
    if (RoleHierarchy.bypassesAuthorization(account.role)) {
      throw AuthorizationErrors.ownerImmutable(action);
    }
  }

  /**
   * The owner cannot delete their own account either — the system must always
   * have one. Separate from {@link assertNotOwner} only so the caller reads as
   * the self-service operation it guards.
   */
  static assertDeletable(account: ProtectedAccount): void {
    this.assertNotOwner(account, ProtectedAction.DELETE);
  }

  /** `OWNER` is never reachable through a role-assignment API. */
  static assertRoleAssignable(role: UserRole): void {
    if (RoleHierarchy.bypassesAuthorization(role)) {
      throw AuthorizationErrors.ownerRoleNotAssignable();
    }
  }

  /**
   * Blocks self-targeting, which is how privilege escalation is usually
   * attempted: an administrator promoting themselves, or granting themselves a
   * permission they were not given.
   */
  static assertNotSelf(
    actorId: string,
    targetId: string,
    action: ProtectedAction
  ): void {
    if (actorId === targetId) {
      throw AuthorizationErrors.selfManagementForbidden(action);
    }
  }
}
