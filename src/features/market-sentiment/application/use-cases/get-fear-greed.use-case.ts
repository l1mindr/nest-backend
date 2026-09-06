import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  FEAR_GREED_PORT,
  FearGreedPort,
  FearGreedSnapshot,
  IGetFearGreedUseCase
} from '../interfaces/market-sentiment.interface';
import { FearGreedCacheService } from '../../infrastructure/cache/fear-greed-cache.service';

@Injectable()
export class GetFearGreedUseCase implements IGetFearGreedUseCase {
  constructor(
    @Inject(FEAR_GREED_PORT)
    private readonly provider: FearGreedPort,
    private readonly cache: FearGreedCacheService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GetFearGreedUseCase.name);
  }

  /**
   * Serves the cached index while fresh; on a cache miss, fetches from the
   * provider and repopulates the cache. If the provider fails, a still-cached
   * (even if expired) value is served rather than failing the request. Only
   * rethrows when there is no cached value at all.
   */
  async execute(): Promise<FearGreedSnapshot> {
    const cached = this.cache.get();
    if (cached) {
      return { ...cached.value, fetchedAt: cached.fetchedAt, isStale: false };
    }

    try {
      const fresh = await this.provider.fetchFearGreedIndex();
      const cached = this.cache.set(fresh);
      return { ...cached.value, fetchedAt: cached.fetchedAt, isStale: false };
    } catch (error) {
      const stale = this.cache.getStale();

      if (stale) {
        this.logger.warn(
          { err: error },
          'Fear & Greed provider failed; serving stale cached value'
        );
        return { ...stale.value, fetchedAt: stale.fetchedAt, isStale: true };
      }

      throw error;
    }
  }
}
