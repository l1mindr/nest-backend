import { ClockService } from '@infrastructure/clock/clock.service';
import { TimeConstants } from '@infrastructure/clock/time.constants';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UserStatus } from '../../domain/enums/user-status.enum';
import {
  ICleanupPendingUsersUseCase,
  IUserRepository,
  IVerificationCodeRepository,
  USER_REPOSITORY,
  VERIFICATION_CODE_REPOSITORY
} from '../interfaces/users.interface';

@Injectable()
export class CleanupPendingUsersUseCase implements ICleanupPendingUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly clockService: ClockService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CleanupPendingUsersUseCase.name);
  }

  async execute(): Promise<void> {
    this.logger.info(
      { event: LogEvent.PENDING_USER_CLEANUP_STARTED },
      'Pending user cleanup started'
    );

    const now = this.clockService.nowDate();
    const cutoff = new Date(now.getTime() - TimeConstants.MS_PER_DAY);

    const pendingUsers = await this.userRepository.findPendingOlderThan(cutoff);

    if (pendingUsers.length === 0) {
      this.logger.info(
        { event: LogEvent.PENDING_USER_CLEANUP_COMPLETED, deactivatedCount: 0 },
        'No pending users older than 24 hours found'
      );
      return;
    }

    for (const user of pendingUsers) {
      await this.verificationCodeRepository.invalidatePreviousCodes(
        user.id,
        now
      );

      await this.userRepository.updateStatus(user.id, UserStatus.DEACTIVATE);

      this.logger.info(
        {
          event: LogEvent.PENDING_USER_DEACTIVATED,
          userId: user.id
        },
        'Pending user deactivated due to expired verification window'
      );
    }

    this.logger.info(
      {
        event: LogEvent.PENDING_USER_CLEANUP_COMPLETED,
        deactivatedCount: pendingUsers.length
      },
      'Pending user cleanup completed'
    );
  }
}
