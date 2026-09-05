import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  IGetUsdtTomanUseCase,
  USDT_TOMAN_PORT,
  UsdtTomanPort,
  UsdtTomanSnapshot
} from '../interfaces/usdt-toman.interface';
import { UsdtTomanCacheService } from '../../infrastructure/cache/usdt-toman-cache.service';

@Injectable()
export class GetUsdtTomanUseCase implements IGetUsdtTomanUseCase {
  constructor(
    @Inject(USDT_TOMAN_PORT)
    private readonly provider: UsdtTomanPort,
    private readonly cache: UsdtTomanCacheService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GetUsdtTomanUseCase.name);
  }

  /**
   * Serves the cached rate while fresh; on a cache miss, fetches from the
   * provider and repopulates the cache. If the provider fails, a still-cached
   * (even if expired) value is served rather than failing the request. Only
   * rethrows when there is no cached value at all.
   */
  async execute(): Promise<UsdtTomanSnapshot> {
    const cached = this.cache.get();
    if (cached) {
      return { ...cached.value, fetchedAt: cached.fetchedAt, isStale: false };
    }

    try {
      const fresh = await this.provider.fetchUsdtTomanRate();
      this.cache.set(fresh);
      return { ...fresh, fetchedAt: new Date(), isStale: false };
    } catch (error) {
      const stale = this.cache.getStale();

      if (stale) {
        this.logger.warn(
          { err: error },
          'USDT rate provider failed; serving stale cached value'
        );
        return { ...stale.value, fetchedAt: stale.fetchedAt, isStale: true };
      }

      throw error;
    }
  }
}
