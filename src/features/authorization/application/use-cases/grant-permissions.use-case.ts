import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PermissionSetRequestDto } from '../../presentation/dto/request/permission-set.request.dto';
import { ProtectedAction } from '../../domain/owner-protection.policy';
import { AdminAccountService } from '../services/admin-account.service';
import {
  ADMIN_PERMISSION_REPOSITORY,
  AuthorizationActor,
  IAdminPermissionRepository,
  IGrantPermissionsUseCase,
  IPermissionEvaluationService,
  PERMISSION_EVALUATION_SERVICE
} from '../interfaces/authorization.interface';

/**
 * Grants permissions to another administrator.
 *
 * Three rules stand between this and privilege escalation, and none of them are
 * restated here: the target must be a manageable administrator and not the
 * caller, which the account service enforces; and the caller can only pass on
 * permissions they already hold, which the evaluation service enforces.
 *
 * Granting is idempotent, so replaying the request is not an error.
 */
@Injectable()
export class GrantPermissionsUseCase implements IGrantPermissionsUseCase {
  constructor(
    @Inject(ADMIN_PERMISSION_REPOSITORY)
    private readonly adminPermissionRepository: IAdminPermissionRepository,
    @Inject(PERMISSION_EVALUATION_SERVICE)
    private readonly permissionEvaluation: IPermissionEvaluationService,
    private readonly adminAccountService: AdminAccountService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GrantPermissionsUseCase.name);
  }

  async execute(
    actor: AuthorizationActor,
    targetId: string,
    { permissions }: PermissionSetRequestDto
  ): Promise<void> {
    await this.adminAccountService.loadManageableAdmin(
      actor.id,
      targetId,
      ProtectedAction.PERMISSION_GRANT
    );

    await this.permissionEvaluation.assertCanDelegate(actor, permissions);

    await this.adminPermissionRepository.grant(targetId, permissions, actor.id);

    this.logger.info(
      {
        event: LogEvent.PERMISSIONS_GRANTED,
        actorId: actor.id,
        userId: targetId,
        permissions
      },
      'Permissions granted to administrator'
    );
  }
}
