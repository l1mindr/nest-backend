import {
  OwnerProtectionPolicy,
  ProtectedAction
} from '@features/authorization/domain/owner-protection.policy';
import { EmailService } from '@infrastructure/email/email.service';
import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { User } from '../../domain/entities/user.entity';
import { UserErrors } from '../../domain/errors/user-errors';
import {
  IUnsuspendUserUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';

@Injectable()
export class UnsuspendUserUseCase implements IUnsuspendUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UnsuspendUserUseCase.name);
  }

  async execute(adminId: string, userId: string): Promise<void> {
    const user = await this.userRepository.findUserForAdmin(userId);

    if (!user) {
      throw UserErrors.userNotFound(userId);
    }

    OwnerProtectionPolicy.assertNotOwner(user, ProtectedAction.UNSUSPEND);

    const previousStatus = user.status;

    user.unsuspend();

    const newStatus = user.status;

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(userId, {
        status: newStatus
      });
    });

    const now = this.clockService.nowDate();

    await this.emailService.sendUnsuspensionEmail(user.email, user.name, now);

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
