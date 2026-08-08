import { LogEvent } from '@infrastructure/logging/logging.constants';
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
    private readonly logger: PinoLogger
  ) {
    super();
    this.logger.setContext(AssetSyncProcessor.name);
  }

  async process(job: Job): Promise<void> {
    try {
      const result = await this.syncUseCase.execute();

      this.logger.info(
        {
          event: LogEvent.ASSET_SYNC_COMPLETED,
          jobId: job.id,
          receivedCount: result.receivedCount,
          synchronizedCount: result.synchronizedCount
        },
        'Asset synchronization completed'
      );
    } catch (error) {
      this.logger.error(
        { event: LogEvent.ASSET_SYNC_FAILED, jobId: job.id, err: error },
        'Asset synchronization failed'
      );
      throw error;
    }
  }
}
