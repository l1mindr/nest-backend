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
  IPermissionEvaluationService,
  IRevokePermissionsUseCase,
  PERMISSION_EVALUATION_SERVICE
} from '../interfaces/authorization.interface';

/**
 * Takes permissions away from another administrator.
 *
 * Held to the same delegation limit as granting: a caller can only revoke what
 * they themselves hold. That stops a narrowly-scoped administrator with
 * `ROLE_ASSIGN` from disarming a colleague whose reach exceeds their own.
 *
 * Revoking a permission the target never held is a no-op, so the endpoint is
 * safe to replay.
 */
@Injectable()
export class RevokePermissionsUseCase implements IRevokePermissionsUseCase {
  constructor(
    @Inject(ADMIN_PERMISSION_REPOSITORY)
    private readonly adminPermissionRepository: IAdminPermissionRepository,
    @Inject(PERMISSION_EVALUATION_SERVICE)
    private readonly permissionEvaluation: IPermissionEvaluationService,
    private readonly adminAccountService: AdminAccountService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(RevokePermissionsUseCase.name);
  }

  async execute(
    actor: AuthorizationActor,
    targetId: string,
    { permissions }: PermissionSetRequestDto
  ): Promise<void> {
    await this.adminAccountService.loadManageableAdmin(
      actor.id,
      targetId,
      ProtectedAction.PERMISSION_REVOKE
    );

    await this.permissionEvaluation.assertCanDelegate(actor, permissions);

    await this.adminPermissionRepository.revoke(targetId, permissions);

    this.logger.info(
      {
        event: LogEvent.PERMISSIONS_REVOKED,
        actorId: actor.id,
        userId: targetId,
        permissions
      },
      'Permissions revoked from administrator'
    );
  }
}
