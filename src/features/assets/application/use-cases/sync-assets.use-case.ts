import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AssetErrors } from '../../domain/errors/asset-errors';
import {
  ASSET_REPOSITORY,
  AssetSyncData,
  IAssetRepository,
  ISyncAssetsUseCase,
  MARKET_DATA_PORT,
  MarketDataEntry,
  MarketDataPort,
  SyncAssetsResult
} from '../interfaces/assets.interface';

@Injectable()
export class SyncAssetsUseCase implements ISyncAssetsUseCase {
  constructor(
    @Inject(MARKET_DATA_PORT)
    private readonly marketDataPort: MarketDataPort,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    private readonly clockService: ClockService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SyncAssetsUseCase.name);
  }

  async execute(): Promise<SyncAssetsResult> {
    const startedAt = Date.now();

    this.logger.info(
      { event: LogEvent.ASSET_SYNC_STARTED },
      'Starting asset synchronization'
    );

    const marketData = await this.fetchMarketData();
    const assets = this.toSyncData(marketData, this.clockService.nowDate());

    if (assets.length === 0) {
      throw AssetErrors.emptySync();
    }

    await this.assetRepository.upsertMany(assets);

    const durationMs = Date.now() - startedAt;

    this.logger.info(
      {
        event: LogEvent.ASSET_SYNC_COMPLETED,
        receivedCount: marketData.length,
        synchronizedCount: assets.length,
        durationMs
      },
      'Asset synchronization completed'
    );

    return {
      receivedCount: marketData.length,
      synchronizedCount: assets.length
    };
  }

  private async fetchMarketData(): Promise<MarketDataEntry[]> {
    try {
      return await this.marketDataPort.fetchMarketData();
    } catch (error) {
      // Provider errors are already classified domain errors (or
      // UnrecoverableError wrappers for permanent rejections). Log the failure
      // for observability and rethrow unchanged so the queue can act on the
      // classification.
      this.logger.error(
        { event: LogEvent.ASSET_SYNC_FAILED, err: error },
        'Market data retrieval failed'
      );
      throw error;
    }
  }

  /**
   * Duplicates are collapsed by provider identifier (last record wins), then
   * each survivor is stamped with the time of this synchronization run.
   */
  private toSyncData(
    entries: MarketDataEntry[],
    lastSyncedAt: Date
  ): AssetSyncData[] {
    const uniqueAssets = new Map<string, AssetSyncData>();

    for (const entry of entries) {
      uniqueAssets.set(entry.coinGeckoId, {
        ...entry,
        lastSyncedAt
      });
    }

    return [...uniqueAssets.values()];
  }
}
