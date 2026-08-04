import { UserRole } from '@features/users/domain/enums/user-role.enum';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import {
  ISessionRevocationUseCase,
  SESSION_REVOCATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import {
  OwnerProtectionPolicy,
  ProtectedAction
} from '../../domain/owner-protection.policy';
import { AdminAccountService } from '../services/admin-account.service';
import {
  ADMIN_PERMISSION_REPOSITORY,
  IAdminPermissionRepository,
  IRevokeAdminRoleUseCase
} from '../interfaces/authorization.interface';

/**
 * Withdraws administrator status: the account drops back to `USER`, every grant
 * it held is deleted and all of its sessions are revoked.
 *
 * The account itself survives. Removing administrative reach and deleting a
 * person's account are different decisions, and conflating them would mean the
 * owner could not demote a colleague without destroying their data; account
 * deletion remains where it already lives, on the self-service endpoint.
 *
 * Sessions are revoked because the access token outlives the demotion, and the
 * role on it is what the next request would otherwise be judged by. Reserved to
 * the owner.
 */
@Injectable()
export class RevokeAdminRoleUseCase implements IRevokeAdminRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ADMIN_PERMISSION_REPOSITORY)
    private readonly adminPermissionRepository: IAdminPermissionRepository,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
    private readonly adminAccountService: AdminAccountService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(RevokeAdminRoleUseCase.name);
  }

  async execute(actorId: string, targetId: string): Promise<void> {
    await this.adminAccountService.loadManageableAdmin(
      actorId,
      targetId,
      ProtectedAction.ROLE_CHANGE
    );

    OwnerProtectionPolicy.assertRoleAssignable(UserRole.USER);

    await this.dataSource.transaction(async (manager) => {
      await this.userRepository.updateRole(targetId, UserRole.USER, manager);
      await this.adminPermissionRepository.revokeAll(targetId, manager);
      await this.revocationUseCase.revokeAll(targetId, manager);
    });

    this.logger.info(
      {
        event: LogEvent.ADMIN_ROLE_REVOKED,
        actorId,
        userId: targetId
      },
      'Administrator role revoked'
    );
  }
}
