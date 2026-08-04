import { RoleHierarchy } from '@features/authorization/domain/role-hierarchy';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { IRequest } from '@presentation/interfaces/custom-request.interface';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SecurityErrors } from '../errors/security-errors';

/**
 * Enforces the role *tier* a route demands. Most routes should not need it —
 * reach for `@RequirePermissions()` instead, which says what the route does
 * rather than who may call it. `@Roles()` remains for the handful of operations
 * reserved to a tier outright, such as the owner-only administrator lifecycle.
 *
 * The comparison is by rank, not equality, so `@Roles(UserRole.ADMIN)` is also
 * satisfied by the owner. That is the point: "the owner can do everything" is
 * expressed once, in the hierarchy, instead of at every call site.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<IRequest>();

    if (!user?.role) {
      throw SecurityErrors.accessDenied();
    }

    const permitted = requiredRoles.some((minimum) =>
      RoleHierarchy.satisfies(user.role, minimum)
    );

    if (!permitted) {
      throw SecurityErrors.accessDenied();
    }

    return true;
  }
}
