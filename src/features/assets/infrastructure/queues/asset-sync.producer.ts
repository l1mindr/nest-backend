import { LogEvent } from '@infrastructure/logging/logging.constants';
import queueConfig from '@infrastructure/queue/queue.config';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import {
  ASSET_SYNC_JOB,
  ASSET_SYNC_MANUAL_DEDUPE_ID,
  ASSET_SYNC_QUEUE
} from './asset-sync.constants';

export interface AssetSyncEnqueueResult {
  jobId: string;
}

/**
 * Enqueues asset synchronization jobs onto the shared `asset-sync` queue.
 *
 * Manual triggers are deduplicated: while a manually requested sync is pending
 * or running, a further request re-uses the same job instead of piling a new
 * CoinGecko run behind it. The scheduled repeating job is separate and driven
 * by {@link AssetSyncScheduler}.
 */
@Injectable()
export class AssetSyncProducer {
  private readonly options: ConfigType<typeof queueConfig>['assetSync'];

  constructor(
    @InjectQueue(ASSET_SYNC_QUEUE) private readonly queue: Queue,
    @Inject(queueConfig.KEY) config: ConfigType<typeof queueConfig>,
    private readonly logger: PinoLogger
  ) {
    this.options = config.assetSync;
    this.logger.setContext(AssetSyncProducer.name);
  }

  async enqueueManualSync(): Promise<AssetSyncEnqueueResult> {
    const job = await this.withPublishTimeout(
      this.queue.add(
        ASSET_SYNC_JOB,
        { trigger: 'manual' },
        {
          deduplication: { id: ASSET_SYNC_MANUAL_DEDUPE_ID },
          attempts: this.options.attempts,
          backoff: { type: 'exponential', delay: this.options.backoffMs },
          removeOnComplete: { count: this.options.keepCompleted },
          removeOnFail: { count: this.options.keepFailed }
        }
      )
    );

    const jobId = job.id ?? ASSET_SYNC_MANUAL_DEDUPE_ID;

    this.logger.info(
      { event: LogEvent.ASSET_SYNC_QUEUED, jobId },
      'Asset synchronization queued'
    );

    return { jobId };
  }

  /**
   * ioredis buffers commands while it reconnects, so an unreachable Redis makes
   * `add` pend rather than reject. Enqueuing sits on the request path, so it
   * gets a deadline of its own.
   */
  private withPublishTimeout<T>(operation: Promise<T>): Promise<T> {
    const { publishTimeoutMs } = this.options;

    let timer: NodeJS.Timeout;

    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `Publishing to the ${ASSET_SYNC_QUEUE} queue timed out after ${publishTimeoutMs}ms`
            )
          ),
        publishTimeoutMs
      );
    });

    return Promise.race([operation, deadline]).finally(() =>
      clearTimeout(timer)
    );
  }
}
