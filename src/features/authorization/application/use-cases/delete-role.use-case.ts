import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  RoleProtectedAction,
  RoleProtectionPolicy
} from '../../domain/role-protection.policy';
import {
  IDeleteRoleUseCase,
  IRoleRepository,
  IUserRoleRepository,
  ROLE_REPOSITORY,
  USER_ROLE_REPOSITORY
} from '../interfaces/authorization.interface';

/**
 * Deletes a custom role.
 *
 * Refused while any account is still assigned to it, so deleting a role can
 * never silently take a permission away from an account that is relying on
 * it — the assignment has to be removed first, one account at a time.
 */
@Injectable()
export class DeleteRoleUseCase implements IDeleteRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: IUserRoleRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(DeleteRoleUseCase.name);
  }

  async execute(roleId: string): Promise<void> {
    const role = await this.roleRepository.findById(roleId);

    if (!role) throw AuthorizationErrors.roleNotFound();

    RoleProtectionPolicy.assertMutable(role, RoleProtectedAction.DELETE);

    const assignments = await this.userRoleRepository.countAssignments(roleId);

    if (assignments > 0) throw AuthorizationErrors.roleHasAssignments();

    await this.roleRepository.delete(roleId);

    this.logger.info(
      { event: LogEvent.ROLE_DELETED, roleId, name: role.name },
      'Role deleted'
    );
  }
}
