import { SecurityErrors } from '@features/security/errors/security-errors';
import { Inject, Injectable } from '@nestjs/common';
import {
  ALL_PERMISSIONS,
  Permission
} from '../../domain/enums/permission.enum';
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

    return this.adminPermissionRepository.findByUserId(actor.id);
  }
}
