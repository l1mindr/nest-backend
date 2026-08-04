import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { UserErrors } from '@features/users/domain/errors/user-errors';
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
import { IChangeAdminStatusUseCase } from '../interfaces/authorization.interface';

/**
 * Turns an administrator's access on and off without touching their role or
 * their permissions.
 *
 * Deactivation is the reversible lever — a colleague on leave, an account being
 * investigated — and is distinct from suspension, which is a moderation
 * decision that notifies the user and is handled by the shared suspend flow.
 * Keeping them apart means neither has to guess at the other's side effects.
 *
 * Sessions are revoked on deactivation for the same reason as on demotion: a
 * token already issued would otherwise keep working.
 */
@Injectable()
export class ChangeAdminStatusUseCase implements IChangeAdminStatusUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
    private readonly adminAccountService: AdminAccountService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ChangeAdminStatusUseCase.name);
  }

  async activate(actorId: string, targetId: string): Promise<void> {
    const target = await this.adminAccountService.loadManageableAdmin(
      actorId,
      targetId,
      ProtectedAction.STATUS_CHANGE
    );

    // Only a deactivated administrator can be reactivated here. Lifting a
    // suspension is a different decision with its own notification, and an
    // account that never verified its email must still do so.
    if (target.status !== UserStatus.DEACTIVATE) {
      throw UserErrors.invalidStatusTransition(
        target.status,
        UserStatus.ACTIVATE
      );
    }

    await this.userRepository.updateStatus(targetId, UserStatus.ACTIVATE);

    this.log(actorId, targetId, target.status, UserStatus.ACTIVATE);
  }

  async deactivate(actorId: string, targetId: string): Promise<void> {
    const target = await this.adminAccountService.loadManageableAdmin(
      actorId,
      targetId,
      ProtectedAction.STATUS_CHANGE
    );

    if (target.status !== UserStatus.ACTIVATE) {
      throw UserErrors.invalidStatusTransition(
        target.status,
        UserStatus.DEACTIVATE
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.userRepository.updateStatus(
        targetId,
        UserStatus.DEACTIVATE,
        manager
      );
      await this.revocationUseCase.revokeAll(targetId, manager);
    });

    this.log(actorId, targetId, target.status, UserStatus.DEACTIVATE);
  }

  private log(
    actorId: string,
    userId: string,
    previousStatus: UserStatus,
    newStatus: UserStatus
  ): void {
    this.logger.info(
      {
        event: LogEvent.ADMIN_STATUS_CHANGED,
        actorId,
        userId,
        previousStatus,
        newStatus
      },
      'Administrator status changed'
    );
  }
}
