import { Permission } from './enums/permission.enum';

/**
 * Human-readable description of every permission, surfaced by
 * `GET /v1/admin/permissions` so an operator can see what a grant actually
 * unlocks before handing it out.
 *
 * The `Record<Permission, string>` annotation is deliberate: adding a member to
 * {@link Permission} without describing it here is a compile error, which is
 * what keeps the catalog from drifting away from the enum.
 *
 * Entries marked *reserved* are part of the permission model but not yet
 * demanded by any route. They exist so that the endpoint which eventually needs
 * one can be introduced without a second round of grants and migrations.
 */
export const PERMISSION_CATALOG: Readonly<Record<Permission, string>> = {
  [Permission.USER_READ]: 'Read any user account and list the directory.',
  [Permission.USER_CREATE]:
    'Create user accounts on behalf of others. Reserved.',
  [Permission.USER_UPDATE]: 'Edit the profile of any user account.',
  [Permission.USER_DELETE]: 'Delete any user account. Reserved.',
  [Permission.USER_SUSPEND]:
    'Suspend a user account and revoke all of its sessions.',
  [Permission.USER_UNSUSPEND]: 'Lift the suspension on a user account.',
  [Permission.ADMIN_READ]:
    'Read the administrator directory and the permissions each one holds.',
  [Permission.ADMIN_UPDATE]: 'Edit the profile of another administrator.',
  [Permission.ROLE_ASSIGN]:
    'Grant and revoke permissions on other administrators, limited to the permissions the caller holds.',
  [Permission.AUDIT_READ]: 'Read the audit trail. Reserved.',
  [Permission.SYSTEM_SETTINGS]: 'Change system-wide settings. Reserved.'
};
