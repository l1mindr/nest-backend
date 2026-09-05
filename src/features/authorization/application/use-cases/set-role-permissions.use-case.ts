import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PermissionSetRequestDto } from '../../presentation/dto/request/permission-set.request.dto';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  RoleProtectedAction,
  RoleProtectionPolicy
} from '../../domain/role-protection.policy';
import {
  AuthorizationActor,
  IPermissionEvaluationService,
  IRoleRepository,
  ISetRolePermissionsUseCase,
  PERMISSION_EVALUATION_SERVICE,
  ROLE_REPOSITORY
} from '../interfaces/authorization.interface';

/**
 * Replaces the full permission set a role grants.
 *
 * Held to the same delegation limit as a direct grant: the caller must
 * already hold every permission being placed into the role. Without that
 * limit a role would be a second way around `assertCanDelegate` — create a
 * role naming a permission you do not hold, assign it to yourself. The DTO
 * also restricts the set to `DELEGABLE_PERMISSIONS`, so an owner-reserved
 * code cannot enter a role even before this check runs.
 */
@Injectable()
export class SetRolePermissionsUseCase implements ISetRolePermissionsUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(PERMISSION_EVALUATION_SERVICE)
    private readonly permissionEvaluation: IPermissionEvaluationService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SetRolePermissionsUseCase.name);
  }

  async execute(
    actor: AuthorizationActor,
    roleId: string,
    { permissions }: PermissionSetRequestDto
  ): Promise<void> {
    const role = await this.roleRepository.findById(roleId);

    if (!role) throw AuthorizationErrors.roleNotFound();

    RoleProtectionPolicy.assertMutable(
      role,
      RoleProtectedAction.PERMISSION_CHANGE
    );

    await this.permissionEvaluation.assertCanDelegate(actor, permissions);

    await this.roleRepository.setPermissions(roleId, permissions);

    this.logger.info(
      {
        event: LogEvent.ROLE_PERMISSIONS_SET,
        actorId: actor.id,
        roleId,
        permissions
      },
      'Role permissions set'
    );
  }
}
