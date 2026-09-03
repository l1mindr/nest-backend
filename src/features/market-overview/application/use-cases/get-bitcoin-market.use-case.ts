import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  BITCOIN_MARKET_PORT,
  BitcoinMarketPort,
  BitcoinMarketSnapshot,
  IGetBitcoinMarketUseCase
} from '../interfaces/bitcoin-market.interface';
import { BitcoinCacheService } from '../../infrastructure/cache/bitcoin-cache.service';

@Injectable()
export class GetBitcoinMarketUseCase implements IGetBitcoinMarketUseCase {
  constructor(
    @Inject(BITCOIN_MARKET_PORT)
    private readonly provider: BitcoinMarketPort,
    private readonly cache: BitcoinCacheService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GetBitcoinMarketUseCase.name);
  }

  /**
   * Serves the cached ticker while fresh; on a cache miss, fetches from the
   * provider and repopulates the cache. If the provider fails, a still-cached
   * (even if expired) value is served rather than failing the request. Only
   * rethrows when there is no cached value at all.
   */
  async execute(): Promise<BitcoinMarketSnapshot> {
    const cached = this.cache.get();
    if (cached) {
      return { ...cached.value, fetchedAt: cached.fetchedAt, isStale: false };
    }

    try {
      const fresh = await this.provider.fetchBitcoinMarketData();
      this.cache.set(fresh);
      return { ...fresh, fetchedAt: new Date(), isStale: false };
    } catch (error) {
      const stale = this.cache.getStale();

      if (stale) {
        this.logger.warn(
          { err: error },
          'Bitcoin market data provider failed; serving stale cached value'
        );
        return { ...stale.value, fetchedAt: stale.fetchedAt, isStale: true };
      }

      throw error;
    }
  }
}
