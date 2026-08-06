/**
 * Every permission the system can evaluate. This enum is the single source of
 * truth: routes reference these members through `@RequirePermissions()`, the
 * grant DTOs validate against them, and the `permission` table is seeded from
 * the same list.
 *
 * Codes are `<RESOURCE>_<ACTION>` and are never reused once retired — a grant
 * row referencing a retired code would silently change meaning.
 *
 * Whether a permission may be delegated at all is a separate question, answered
 * by `PERMISSION_CATALOG`: the `ADMIN_*` and `ROLE_ASSIGN` codes are reserved to
 * the owner and can never be held by anyone else.
 */
export enum Permission {
  USER_READ = 'USER_READ',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_SUSPEND = 'USER_SUSPEND',
  USER_UNSUSPEND = 'USER_UNSUSPEND',

  ADMIN_READ = 'ADMIN_READ',
  ADMIN_INVITE = 'ADMIN_INVITE',
  ADMIN_UPDATE = 'ADMIN_UPDATE',
  ADMIN_DELETE = 'ADMIN_DELETE',
  ADMIN_STATUS = 'ADMIN_STATUS',

  ROLE_ASSIGN = 'ROLE_ASSIGN',

  AUDIT_READ = 'AUDIT_READ',
  SYSTEM_SETTINGS = 'SYSTEM_SETTINGS'
}

/** All permission codes, for seeding and for validating grant payloads. */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);
