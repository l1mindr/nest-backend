import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

/**
 * Declares what a route needs, not who may call it.
 *
 * ```ts
 * @RequirePermissions(Permission.USER_DELETE)
 * ```
 *
 * Requirements are conjunctive — listing several demands all of them. The owner
 * satisfies any requirement without evaluation.
 *
 * Applied to a controller class it covers every route in it; a route-level
 * declaration overrides the class-level one rather than adding to it, matching
 * how `@Roles()` already behaves.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
