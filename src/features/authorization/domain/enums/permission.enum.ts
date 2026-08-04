/**
 * Every permission the system can evaluate. This enum is the single source of
 * truth: routes reference these members through `@RequirePermissions()`, the
 * grant DTOs validate against them, and the `permission` table is seeded from
 * the same list.
 *
 * Codes are `<RESOURCE>_<ACTION>` and are never reused once retired — a grant
 * row referencing a retired code would silently change meaning.
 */
export enum Permission {
  USER_READ = 'USER_READ',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_SUSPEND = 'USER_SUSPEND',
  USER_UNSUSPEND = 'USER_UNSUSPEND',

  ADMIN_READ = 'ADMIN_READ',
  ADMIN_UPDATE = 'ADMIN_UPDATE',

  ROLE_ASSIGN = 'ROLE_ASSIGN',

  AUDIT_READ = 'AUDIT_READ',
  SYSTEM_SETTINGS = 'SYSTEM_SETTINGS'
}

/** All permission codes, for seeding and for validating grant payloads. */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);
