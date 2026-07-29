import { IS_TEST } from '@infrastructure/config/env/env.constants';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import {
  CLEANUP_PENDING_USERS_USE_CASE,
  ICleanupPendingUsersUseCase
} from '../../application/interfaces/users.interface';

@Injectable()
export class PendingUserCleanupScheduler {
  constructor(
    @Inject(CLEANUP_PENDING_USERS_USE_CASE)
    private readonly cleanupPendingUsersUseCase: ICleanupPendingUsersUseCase,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(PendingUserCleanupScheduler.name);
  }

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'pending-user-cleanup',
    disabled: IS_TEST,
    waitForCompletion: true
  })
  async handleCleanup(): Promise<void> {
    try {
      await this.cleanupPendingUsersUseCase.execute();
    } catch (error) {
      this.logger.error(
        {
          event: LogEvent.PENDING_USER_CLEANUP_FAILED,
          err: error
        },
        'Scheduled pending user cleanup failed'
      );
    }
  }
}
