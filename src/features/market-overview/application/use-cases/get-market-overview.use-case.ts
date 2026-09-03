import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  GLOBAL_MARKET_DATA_PORT,
  GlobalMarketDataEntry,
  GlobalMarketDataPort,
  IGetMarketOverviewUseCase
} from '../interfaces/market-overview.interface';
import { MarketOverviewCacheService } from '../../infrastructure/cache/market-overview-cache.service';

@Injectable()
export class GetMarketOverviewUseCase implements IGetMarketOverviewUseCase {
  constructor(
    @Inject(GLOBAL_MARKET_DATA_PORT)
    private readonly provider: GlobalMarketDataPort,
    private readonly cache: MarketOverviewCacheService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GetMarketOverviewUseCase.name);
  }

  /**
   * Serves the cached snapshot while fresh; on a cache miss, fetches from the
   * provider and repopulates the cache. If the provider fails, a still-cached
   * (even if expired) value is served rather than failing the request — a
   * read-only display widget should prefer slightly stale data over an error
   * when the alternative to stale data exists. Only rethrows when there is no
   * cached value at all.
   */
  async execute(): Promise<GlobalMarketDataEntry> {
    const cached = this.cache.get();
    if (cached) return cached;

    try {
      const fresh = await this.provider.fetchGlobalMarketData();
      this.cache.set(fresh);
      return fresh;
    } catch (error) {
      const stale = this.cache.getStale();

      if (stale) {
        this.logger.warn(
          { err: error },
          'Global market data provider failed; serving stale cached value'
        );
        return stale;
      }

      throw error;
    }
  }
}
