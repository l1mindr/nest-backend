import { Permission } from './enums/permission.enum';

export interface PermissionMeta {
  readonly description: string;
  /**
   * Reserved to the owner: it can never be granted, and never satisfies a
   * requirement for anyone but the owner, who bypasses evaluation entirely.
   *
   * This is what makes administrator management owner-only *without* a role
   * check anywhere near a controller. Routes still declare
   * `@RequirePermissions(...)` like every other route; the permissions they name
   * simply have nobody to be granted to.
   *
   * Relaxing the restriction later is one flag per permission — no controller,
   * guard or use case changes.
   */
  readonly ownerOnly: boolean;
}

/**
 * What every permission means, and whether it can be delegated.
 *
 * The `Record<Permission, PermissionMeta>` annotation is deliberate: adding a
 * member to {@link Permission} without describing it here is a compile error,
 * and so is forgetting to decide whether it is delegable.
 *
 * This lives in code rather than in the `permission` table for the same reason
 * the role hierarchy does: a row an operator could edit is a row that could
 * hand administrator management to an administrator. Descriptions are data;
 * delegability is policy.
 *
 * Entries marked *reserved* are part of the permission model but not yet
 * demanded by any route. They exist so that the endpoint which eventually needs
 * one can be introduced without a second round of grants and migrations.
 */
export const PERMISSION_CATALOG: Readonly<Record<Permission, PermissionMeta>> =
  {
    [Permission.USER_READ]: {
      description: 'Read any user account and list the user directory.',
      ownerOnly: false
    },
    [Permission.USER_CREATE]: {
      description: 'Create user accounts on behalf of others. Reserved.',
      ownerOnly: false
    },
    [Permission.USER_UPDATE]: {
      description: 'Edit the profile of any user account.',
      ownerOnly: false
    },
    [Permission.USER_DELETE]: {
      description: 'Delete any user account. Reserved.',
      ownerOnly: false
    },
    [Permission.USER_SUSPEND]: {
      description: 'Suspend a user account and revoke all of its sessions.',
      ownerOnly: false
    },
    [Permission.USER_UNSUSPEND]: {
      description: 'Lift the suspension on a user account.',
      ownerOnly: false
    },
    [Permission.ADMIN_READ]: {
      description:
        'Read the administrator directory and the permissions each administrator holds.',
      ownerOnly: true
    },
    [Permission.ADMIN_INVITE]: {
      description: 'Invite new administrators and revoke pending invitations.',
      ownerOnly: true
    },
    [Permission.ADMIN_UPDATE]: {
      description: 'Edit an administrator profile.',
      ownerOnly: true
    },
    [Permission.ADMIN_DELETE]: {
      description: 'Delete an administrator account.',
      ownerOnly: true
    },
    [Permission.ADMIN_STATUS]: {
      description:
        'Activate, deactivate, suspend or unsuspend an administrator account.',
      ownerOnly: true
    },
    [Permission.ROLE_ASSIGN]: {
      description: 'Grant and revoke permissions on administrator accounts.',
      ownerOnly: true
    },
    [Permission.ROLE_READ]: {
      description:
        'Read the role catalog and which permissions each role grants.',
      ownerOnly: true
    },
    [Permission.ROLE_CREATE]: {
      description: 'Create a named role.',
      ownerOnly: true
    },
    [Permission.ROLE_UPDATE]: {
      description:
        'Rename a role, edit its description, or change the permissions it grants.',
      ownerOnly: true
    },
    [Permission.ROLE_DELETE]: {
      description: 'Delete a role that has no accounts assigned to it.',
      ownerOnly: true
    },
    [Permission.AUDIT_READ]: {
      description: 'Read the audit trail. Reserved.',
      ownerOnly: false
    },
    [Permission.SYSTEM_SETTINGS]: {
      description: 'Change system-wide settings. Reserved.',
      ownerOnly: false
    }
  };

/** Whether this permission is reserved to the owner and cannot be delegated. */
export const isOwnerOnly = (permission: Permission): boolean =>
  PERMISSION_CATALOG[permission].ownerOnly;

/** The permissions an administrator is allowed to hold. */
export const DELEGABLE_PERMISSIONS: readonly Permission[] = (
  Object.keys(PERMISSION_CATALOG) as Permission[]
).filter((permission) => !isOwnerOnly(permission));
