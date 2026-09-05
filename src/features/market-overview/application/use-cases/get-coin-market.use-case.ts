import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  COIN_MARKET_PORT,
  CoinMarketPort,
  CoinMarketSnapshot,
  IGetCoinMarketUseCase
} from '../interfaces/coin-market.interface';
import { CoinMarketCacheService } from '../../infrastructure/cache/coin-market-cache.service';

@Injectable()
export class GetCoinMarketUseCase implements IGetCoinMarketUseCase {
  constructor(
    @Inject(COIN_MARKET_PORT)
    private readonly provider: CoinMarketPort,
    private readonly cache: CoinMarketCacheService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GetCoinMarketUseCase.name);
  }

  /**
   * Serves the cached ticker while fresh; on a cache miss, fetches from the
   * provider and repopulates the cache. If the provider fails, a still-cached
   * (even if expired) value is served rather than failing the request. Only
   * rethrows when there is no cached value at all.
   */
  async execute(coinId: string): Promise<CoinMarketSnapshot> {
    const cached = this.cache.get(coinId);
    if (cached) {
      return { ...cached.value, fetchedAt: cached.fetchedAt, isStale: false };
    }

    try {
      const fresh = await this.provider.fetchCoinMarketData(coinId);
      this.cache.set(coinId, fresh);
      return { ...fresh, fetchedAt: new Date(), isStale: false };
    } catch (error) {
      const stale = this.cache.getStale(coinId);

      if (stale) {
        this.logger.warn(
          { err: error, coinId },
          'Coin market data provider failed; serving stale cached value'
        );
        return { ...stale.value, fetchedAt: stale.fetchedAt, isStale: true };
      }

      throw error;
    }
  }
}
