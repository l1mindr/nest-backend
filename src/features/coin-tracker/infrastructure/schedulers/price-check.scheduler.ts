import { IS_TEST } from '@infrastructure/config/env/env.constants';
import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import {
  IPriceCheckService,
  PRICE_CHECK_SERVICE
} from '../../application/interfaces/coin-tracker.interface';

const PRICE_CHECK_LOCK_ID = 'minute';
const PRICE_CHECK_LOCK_TTL_SECONDS = 5 * 60;

@Injectable()
export class PriceCheckScheduler {
  constructor(
    @Inject(PRICE_CHECK_SERVICE)
    private readonly priceCheckService: IPriceCheckService,
    private readonly redisLockService: RedisLockService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(PriceCheckScheduler.name);
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'price-alert-check',
    disabled: IS_TEST,
    waitForCompletion: true
  })
  async handleCheck(): Promise<void> {
    let lockToken: string | null = null;

    try {
      lockToken = await this.redisLockService.acquire(
        RedisKey.PRICE_CHECK_LOCK,
        PRICE_CHECK_LOCK_ID,
        PRICE_CHECK_LOCK_TTL_SECONDS
      );

      if (!lockToken) {
        this.logger.info(
          { event: LogEvent.PRICE_CHECK_SKIPPED, reason: 'lock_unavailable' },
          'Price alert check skipped'
        );
        return;
      }

      await this.priceCheckService.check();
    } catch (error) {
      this.logger.error(
        { event: LogEvent.PRICE_CHECK_FAILED, err: error },
        'Scheduled price alert check failed'
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
        RedisKey.PRICE_CHECK_LOCK,
        PRICE_CHECK_LOCK_ID,
        lockToken
      );
    } catch (error) {
      this.logger.error(
        { event: LogEvent.PRICE_CHECK_FAILED, err: error },
        'Price alert check lock release failed'
      );
    }
  }
}
