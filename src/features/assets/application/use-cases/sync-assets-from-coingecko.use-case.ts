import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AssetErrors } from '../../domain/errors/asset-errors';
import {
  ASSET_REPOSITORY,
  AssetSyncData,
  COINGECKO_PORT,
  CoinGeckoMarketData,
  CoinGeckoPort,
  IAssetRepository,
  ISyncAssetsUseCase,
  SyncAssetsResult
} from '../interfaces/assets.interface';

@Injectable()
export class SyncAssetsFromCoinGeckoUseCase implements ISyncAssetsUseCase {
  constructor(
    @Inject(COINGECKO_PORT)
    private readonly coingeckoPort: CoinGeckoPort,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    private readonly clockService: ClockService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SyncAssetsFromCoinGeckoUseCase.name);
  }

  async execute(): Promise<SyncAssetsResult> {
    this.logger.info(
      { event: LogEvent.ASSET_SYNC_STARTED },
      'Starting asset synchronization'
    );

    let marketData: CoinGeckoMarketData[];

    try {
      marketData = await this.coingeckoPort.fetchMarketData();
    } catch (error) {
      this.logger.error(
        { event: LogEvent.ASSET_SYNC_FAILED, err: error },
        'CoinGecko market data retrieval failed'
      );
      throw AssetErrors.coingeckoApiError(
        error instanceof Error ? error.message : String(error)
      );
    }

    const assets = this.normalizeAssets(
      marketData,
      this.clockService.nowDate()
    );

    if (assets.length === 0) {
      throw AssetErrors.emptySync();
    }

    await this.assetRepository.upsertMany(assets);

    this.logger.info(
      {
        event: LogEvent.ASSET_SYNC_COMPLETED,
        receivedCount: marketData.length,
        synchronizedCount: assets.length
      },
      'Asset synchronization completed'
    );

    return {
      receivedCount: marketData.length,
      synchronizedCount: assets.length
    };
  }

  private normalizeAssets(
    items: CoinGeckoMarketData[],
    lastSyncedAt: Date
  ): AssetSyncData[] {
    const uniqueAssets = new Map<string, AssetSyncData>();

    for (const item of items) {
      if (
        typeof item.id !== 'string' ||
        typeof item.symbol !== 'string' ||
        typeof item.name !== 'string'
      ) {
        continue;
      }

      const coinGeckoId = item.id.trim().toLowerCase();
      const symbol = item.symbol.trim().toLowerCase();
      const name = item.name.trim();

      if (!coinGeckoId || !symbol || !name) continue;

      uniqueAssets.set(coinGeckoId, {
        coinGeckoId,
        symbol,
        name,
        imageUrl: typeof item.image === 'string' ? item.image : null,
        currentPrice: this.toFiniteString(item.current_price),
        marketCap: this.toFiniteString(item.market_cap),
        marketCapRank: this.toFiniteNumber(item.market_cap_rank),
        totalVolume: this.toFiniteString(item.total_volume),
        circulatingSupply: this.toFiniteString(item.circulating_supply),
        totalSupply: this.toFiniteString(item.total_supply),
        maxSupply: this.toFiniteString(item.max_supply),
        priceChange24h: this.toFiniteString(item.price_change_24h),
        priceChangePercentage24h: this.toFiniteString(
          item.price_change_percentage_24h
        ),
        lastSyncedAt
      });
    }

    return [...uniqueAssets.values()];
  }

  private toFiniteString(value: unknown): string | null {
    return typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : null;
  }

  private toFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
