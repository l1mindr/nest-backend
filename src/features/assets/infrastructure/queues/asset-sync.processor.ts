import { LogEvent } from '@infrastructure/logging/logging.constants';
import { SystemLogEvent } from '@infrastructure/logging/mongodb/mongodb.constants';
import { SystemLogService } from '@infrastructure/logging/system/system-log.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import {
  ISyncAssetsUseCase,
  SYNC_ASSETS_USE_CASE
} from '../../application/interfaces/assets.interface';
import {
  ASSET_SYNC_QUEUE,
  ASSET_WORKER_CONCURRENCY
} from './asset-sync.constants';

@Processor(ASSET_SYNC_QUEUE, { concurrency: ASSET_WORKER_CONCURRENCY })
export class AssetSyncProcessor extends WorkerHost {
  constructor(
    @Inject(SYNC_ASSETS_USE_CASE)
    private readonly syncUseCase: ISyncAssetsUseCase,
    private readonly logger: PinoLogger,
    private readonly systemLogService: SystemLogService
  ) {
    super();
    this.logger.setContext(AssetSyncProcessor.name);
  }

  async process(job: Job): Promise<void> {
    const startedAt = Date.now();
    const attempt = job.attemptsMade + 1;

    try {
      const result = await this.syncUseCase.execute();

      this.logger.info(
        {
          event: LogEvent.ASSET_SYNC_COMPLETED,
          jobId: job.id,
          attempt,
          trigger: job.data?.trigger,
          receivedCount: result.receivedCount,
          synchronizedCount: result.synchronizedCount,
          durationMs: Date.now() - startedAt
        },
        'Asset synchronization completed'
      );
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      this.logger.error(
        {
          event: LogEvent.ASSET_SYNC_FAILED,
          jobId: job.id,
          attempt,
          durationMs,
          err: error
        },
        'Asset synchronization failed'
      );

      this.systemLogService.error(
        SystemLogEvent.ASSET_SYNC_FAILED,
        'Asset synchronization failed',
        {
          context: AssetSyncProcessor.name,
          durationMs,
          error: error instanceof Error ? error : undefined,
          metadata: { jobId: job.id, attempt }
        }
      );

      throw error;
    }
  }
}
