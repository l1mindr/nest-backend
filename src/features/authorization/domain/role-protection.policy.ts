import { AuthorizationErrors } from './errors/authorization-errors';

/**
 * Guards `OWNER`, `ADMIN` and `USER` — the system roles seeded by migration —
 * from being renamed, re-described, re-permissioned or deleted.
 *
 * They exist as catalog entries mirroring the account tiers already enforced
 * by `user.role`; nothing about the tiers depends on their permission set, so
 * there is nothing safe an edit to them could express. Named and centralised
 * here rather than as `if (role.isSystem)` at each call site, exactly like
 * {@link OwnerProtectionPolicy} does for the owner account.
 */
export class RoleProtectionPolicy {
  static assertMutable(role: { isSystem: boolean }, action: string): void {
    if (role.isSystem) throw AuthorizationErrors.roleProtected(action);
  }
}

export const RoleProtectedAction = {
  RENAME: 'RENAME',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  DELETE: 'DELETE'
} as const;

export type RoleProtectedAction =
  (typeof RoleProtectedAction)[keyof typeof RoleProtectedAction];
