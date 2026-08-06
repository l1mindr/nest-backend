import { SecurityErrors } from '@features/security/errors/security-errors';
import { Inject, Injectable } from '@nestjs/common';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  ALL_PERMISSIONS,
  Permission
} from '../../domain/enums/permission.enum';
import { isOwnerOnly } from '../../domain/permission.catalog';
import { RoleHierarchy } from '../../domain/role-hierarchy';
import {
  ADMIN_PERMISSION_REPOSITORY,
  AuthorizationActor,
  IAdminPermissionRepository,
  IPermissionEvaluationService
} from '../interfaces/authorization.interface';

/**
 * The single place a permission question is answered.
 *
 * The flow is the one the model describes: the owner is allowed without any
 * lookup, everyone else is measured against the permissions actually granted to
 * their account. Roles below administrator simply hold no grants, so they fall
 * out of the same evaluation as denied — no per-role branch, and no rule that
 * has to be restated when a tier is added.
 *
 * Requirements are conjunctive: `@RequirePermissions(A, B)` demands both.
 *
 * Grants are read per request rather than carried in the access token, which is
 * what makes a revocation take effect immediately instead of at the next token
 * rotation. The read only happens on routes that declare a requirement, so the
 * ordinary authenticated path pays nothing for it.
 */
@Injectable()
export class PermissionEvaluationService implements IPermissionEvaluationService {
  constructor(
    @Inject(ADMIN_PERMISSION_REPOSITORY)
    private readonly adminPermissionRepository: IAdminPermissionRepository
  ) {}

  async can(
    actor: AuthorizationActor,
    required: readonly Permission[]
  ): Promise<boolean> {
    if (RoleHierarchy.bypassesAuthorization(actor.role)) return true;

    if (required.length === 0) return true;

    // An owner-reserved requirement is unsatisfiable for anyone else, whatever
    // the grant table happens to contain. Checked here rather than trusting the
    // write paths, so a row inserted by hand or by a future bug still cannot
    // hand administrator management to an administrator.
    if (required.some(isOwnerOnly)) return false;

    const held = new Set(
      await this.adminPermissionRepository.findByUserId(actor.id)
    );

    return required.every((permission) => held.has(permission));
  }

  async assertCan(
    actor: AuthorizationActor,
    required: readonly Permission[]
  ): Promise<void> {
    if (await this.can(actor, required)) return;

    throw SecurityErrors.accessDenied();
  }

  /**
   * What the account can do right now. The owner is reported as holding
   * everything: they bypass evaluation, so anything less would describe a
   * limitation that does not exist.
   */
  async effectivePermissionsOf(
    actor: AuthorizationActor
  ): Promise<Permission[]> {
    if (RoleHierarchy.bypassesAuthorization(actor.role)) {
      return [...ALL_PERMISSIONS];
    }

    const held = await this.adminPermissionRepository.findByUserId(actor.id);

    // Same defence as `can`: an owner-reserved code that somehow reached the
    // grant table is not reported as held, because it would not be honoured.
    return held.filter((permission) => !isOwnerOnly(permission));
  }

  /**
   * Whether the caller may hand these permissions to, or take them from,
   * another administrator.
   *
   * An administrator can only delegate what they themselves hold. Without that
   * rule, `ROLE_ASSIGN` alone would be equivalent to every permission — hold it
   * and grant yourself the rest through a colleague. The same limit applies to
   * revocation, so a narrowly-scoped administrator cannot strip the reach of
   * one who outranks them in practice.
   *
   * The owner passes the "holds it" test trivially, but not the reservation
   * test: an owner-reserved permission has nobody it can legitimately be given
   * to, so handing one out is refused for every caller alike.
   */
  async assertCanDelegate(
    actor: AuthorizationActor,
    permissions: readonly Permission[]
  ): Promise<void> {
    const reserved = permissions.filter(isOwnerOnly);

    if (reserved.length > 0) {
      throw AuthorizationErrors.permissionReservedToOwner(reserved);
    }

    const held = new Set(await this.effectivePermissionsOf(actor));

    const missing = permissions.filter((permission) => !held.has(permission));

    if (missing.length > 0) {
      throw AuthorizationErrors.permissionNotHeld(missing);
    }
  }
}
