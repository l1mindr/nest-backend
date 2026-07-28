import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
import { IS_TEST } from '@infrastructure/config/env/env.constants';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import {
  ISyncCoinsUseCase,
  SYNC_COINS_USE_CASE
} from '../interfaces/coin-tracker.interface';

const COIN_SYNC_LOCK_ID = 'daily';
const COIN_SYNC_LOCK_TTL_SECONDS = 30 * 60;

@Injectable()
export class CoinSyncScheduler {
  constructor(
    @Inject(SYNC_COINS_USE_CASE)
    private readonly syncCoinsUseCase: ISyncCoinsUseCase,
    private readonly redisLockService: RedisLockService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CoinSyncScheduler.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'coin-sync',
    disabled: IS_TEST,
    waitForCompletion: true
  })
  async handleSync(): Promise<void> {
    let lockToken: string | null = null;

    try {
      lockToken = await this.redisLockService.acquire(
        RedisKey.COIN_SYNC_LOCK,
        COIN_SYNC_LOCK_ID,
        COIN_SYNC_LOCK_TTL_SECONDS
      );

      if (!lockToken) {
        this.logger.info(
          { event: LogEvent.COIN_SYNC_SKIPPED, reason: 'lock_unavailable' },
          'Coin synchronization skipped'
        );
        return;
      }

      await this.syncCoinsUseCase.execute();
    } catch (error) {
      this.logger.error(
        { event: LogEvent.COIN_SYNC_FAILED, err: error },
        'Scheduled coin synchronization failed'
      );
    } finally {
      if (lockToken) {
        await this.releaseLock(lockToken);
      }
    }
  }

  private async releaseLock(lockToken: string): Promise<void> {
    try {
      await this.redisLockService.release(
        RedisKey.COIN_SYNC_LOCK,
        COIN_SYNC_LOCK_ID,
        lockToken
      );
    } catch (error) {
      this.logger.error(
        { event: LogEvent.COIN_SYNC_FAILED, err: error },
        'Coin synchronization lock release failed'
      );
    }
  }
}
