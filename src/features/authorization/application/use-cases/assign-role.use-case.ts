import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  OwnerProtectionPolicy,
  ProtectedAction
} from '../../domain/owner-protection.policy';
import {
  AuthorizationActor,
  IAssignRoleUseCase,
  IPermissionEvaluationService,
  IRoleRepository,
  IUserRoleRepository,
  PERMISSION_EVALUATION_SERVICE,
  ROLE_REPOSITORY,
  USER_ROLE_REPOSITORY
} from '../interfaces/authorization.interface';

/**
 * Assigns a role to an account.
 *
 * Not restricted to the administrator population the way a direct permission
 * grant is: any non-owner account may receive a role, which is what makes a
 * role a general instrument rather than an extension of `admin_permission`.
 * That is safe because reaching this use case at all requires `ROLE_ASSIGN`,
 * which is owner-reserved and can never be delegated — in practice only the
 * owner can ever call it.
 *
 * `assertCanDelegate` is checked against the role's own permission set for
 * the same reason `GrantPermissionsUseCase` checks it against the permissions
 * named directly: a caller must already hold what they are handing out, even
 * though `SetRolePermissionsUseCase` already keeps an owner-reserved
 * permission out of any role in the first place.
 */
@Injectable()
export class AssignRoleUseCase implements IAssignRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: IUserRoleRepository,
    @Inject(PERMISSION_EVALUATION_SERVICE)
    private readonly permissionEvaluation: IPermissionEvaluationService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(AssignRoleUseCase.name);
  }

  async execute(
    actor: AuthorizationActor,
    userId: string,
    roleId: string
  ): Promise<void> {
    const target = await this.userRepository.findUserForAdmin(userId);

    if (!target) throw UserErrors.userNotFound(userId);

    OwnerProtectionPolicy.assertNotOwner(target, ProtectedAction.ROLE_CHANGE);
    OwnerProtectionPolicy.assertNotSelf(
      actor.id,
      userId,
      ProtectedAction.ROLE_CHANGE
    );

    const role = await this.roleRepository.findById(roleId);

    if (!role) throw AuthorizationErrors.roleNotFound();

    const permissions = await this.roleRepository.permissionsOf(roleId);

    await this.permissionEvaluation.assertCanDelegate(actor, permissions);

    await this.userRoleRepository.assign(userId, roleId, actor.id);

    this.logger.info(
      {
        event: LogEvent.ROLE_ASSIGNED,
        actorId: actor.id,
        userId,
        roleId
      },
      'Role assigned to account'
    );
  }
}
