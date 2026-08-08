import {
  ISessionRevocationUseCase,
  SESSION_REVOCATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/enums/user-role.enum';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { UserErrors } from '../../domain/errors/user-errors';
import {
  ISuspendUserUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';

/**
 * Suspension, shared by user management and administrator management.
 *
 * `targetRole` names the population the calling route administers. Asserting it
 * is what keeps the two endpoints from reaching into each other: the user route
 * passes `USER` and so cannot touch an administrator, the administrator route
 * passes `ADMIN` and so cannot touch an ordinary user. The owner matches
 * neither and is therefore unreachable through both — answering "not found"
 * rather than a distinct refusal, which would confirm the account exists.
 */
@Injectable()
export class SuspendUserUseCase implements ISuspendUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
    private readonly emailPublisher: EmailPublisher,
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SuspendUserUseCase.name);
  }

  async execute(
    adminId: string,
    userId: string,
    reason: string,
    targetRole: UserRole
  ): Promise<void> {
    const user = await this.userRepository.findUserForAdmin(userId);

    if (!user || user.role !== targetRole) {
      throw UserErrors.userNotFound(userId);
    }

    if (user.status === UserStatus.SUSPEND) {
      throw UserErrors.userAlreadySuspended();
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(userId, {
        status: UserStatus.SUSPEND
      });
      await this.revocationUseCase.revokeAll(userId, manager);
    });

    const now = this.clockService.nowDate();

    // Queued rather than sent: the suspension and the session revocation are
    // already committed, and the administrator waiting on this response should
    // not wait on SMTP. No deduplication key is needed — a second run of this
    // use case is refused by the `SUSPEND` status check above.
    await this.emailPublisher.publish({
      type: EmailMessageType.SUSPENSION,
      to: user.email,
      data: {
        displayName: user.name,
        reason,
        suspendedAt: now.toISOString()
      }
    });

    this.logger.info(
      {
        event: LogEvent.USER_SUSPENDED,
        adminId,
        userId,
        reason
      },
      'User suspended by administrator'
    );
  }
}
