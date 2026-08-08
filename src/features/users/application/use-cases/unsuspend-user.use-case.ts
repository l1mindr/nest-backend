import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/enums/user-role.enum';
import { UserErrors } from '../../domain/errors/user-errors';
import {
  IUnsuspendUserUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';

/** Counterpart to `SuspendUserUseCase`; `targetRole` scopes it the same way. */
@Injectable()
export class UnsuspendUserUseCase implements IUnsuspendUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly emailPublisher: EmailPublisher,
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UnsuspendUserUseCase.name);
  }

  async execute(
    adminId: string,
    userId: string,
    targetRole: UserRole
  ): Promise<void> {
    const user = await this.userRepository.findUserForAdmin(userId);

    if (!user || user.role !== targetRole) {
      throw UserErrors.userNotFound(userId);
    }

    const previousStatus = user.status;

    user.unsuspend();

    const newStatus = user.status;

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(userId, {
        status: newStatus
      });
    });

    const now = this.clockService.nowDate();

    // As with suspension: queued after the commit, and guarded against a repeat
    // by `unsuspend()`, which refuses any status other than `SUSPEND`.
    await this.emailPublisher.publish({
      type: EmailMessageType.UNSUSPENSION,
      to: user.email,
      data: {
        displayName: user.name,
        unsuspendedAt: now.toISOString()
      }
    });

    this.logger.info(
      {
        event: LogEvent.USER_UNSUSPENDED,
        adminId,
        userId,
        previousStatus,
        newStatus
      },
      'User unsuspended by administrator'
    );
  }
}
