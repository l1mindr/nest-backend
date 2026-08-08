import { IS_TEST } from '@infrastructure/config/env/env.constants';
import queueConfig from '@infrastructure/queue/queue.config';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ASSET_SYNC_JOB, ASSET_SYNC_QUEUE } from './asset-sync.constants';

@Injectable()
export class AssetSyncScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(ASSET_SYNC_QUEUE) private readonly queue: Queue,
    @Inject(queueConfig.KEY)
    private readonly config: ConfigType<typeof queueConfig>,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(AssetSyncScheduler.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (IS_TEST) return;

    await this.queue.upsertJobScheduler(
      ASSET_SYNC_JOB,
      { every: this.config.assetSync.intervalSeconds * 1000 },
      {
        name: ASSET_SYNC_JOB,
        data: {},
        opts: {
          attempts: this.config.assetSync.attempts,
          backoff: {
            type: 'exponential',
            delay: this.config.assetSync.backoffMs
          },
          removeOnComplete: { count: this.config.assetSync.keepCompleted },
          removeOnFail: { count: this.config.assetSync.keepFailed }
        }
      }
    );
  }
}
