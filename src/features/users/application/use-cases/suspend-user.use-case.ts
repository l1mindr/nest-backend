import {
  OwnerProtectionPolicy,
  ProtectedAction
} from '@features/authorization/domain/owner-protection.policy';
import {
  ISessionRevocationUseCase,
  SESSION_REVOCATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import { EmailService } from '@infrastructure/email/email.service';
import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { User } from '../../domain/entities/user.entity';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { UserErrors } from '../../domain/errors/user-errors';
import {
  ISuspendUserUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';

@Injectable()
export class SuspendUserUseCase implements ISuspendUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
    private readonly emailService: EmailService,
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SuspendUserUseCase.name);
  }

  async execute(
    adminId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    const user = await this.userRepository.findUserForAdmin(userId);

    if (!user) {
      throw UserErrors.userNotFound(userId);
    }

    OwnerProtectionPolicy.assertNotOwner(user, ProtectedAction.SUSPEND);

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

    await this.emailService.sendSuspensionEmail(
      user.email,
      user.name,
      reason,
      now
    );

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
