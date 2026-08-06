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
import { ProtectedAction } from '../../domain/owner-protection.policy';
import { AdminAccountService } from '../services/admin-account.service';
import {
  ADMIN_PERMISSION_REPOSITORY,
  IAdminPermissionRepository,
  IDeleteAdminUseCase
} from '../interfaces/authorization.interface';

/**
 * Deletes an administrator: the account is soft-removed, every grant it held is
 * dropped and all of its sessions are revoked, in one transaction.
 *
 * Administrators are created by invitation and were never ordinary users, so
 * there is no earlier state to fall back to — demoting one to `USER` would put
 * an account into the user population that never belonged there, and would show
 * up in user management as a result.
 *
 * Sessions are revoked because the access token outlives the deletion, and the
 * role on it is what the next request would otherwise be judged by.
 */
@Injectable()
export class DeleteAdminUseCase implements IDeleteAdminUseCase {
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
    this.logger.setContext(DeleteAdminUseCase.name);
  }

  async execute(actorId: string, targetId: string): Promise<void> {
    const target = await this.adminAccountService.loadManageableAdmin(
      actorId,
      targetId,
      ProtectedAction.DELETE
    );

    await this.dataSource.transaction(async (manager) => {
      await this.adminPermissionRepository.revokeAll(targetId, manager);
      await this.revocationUseCase.revokeAll(targetId, manager);
      await this.userRepository.softDeleteUser(target, manager);
    });

    this.logger.info(
      {
        event: LogEvent.ADMIN_DELETED,
        actorId,
        userId: targetId
      },
      'Administrator account deleted'
    );
  }
}
