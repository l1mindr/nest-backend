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
   * provider and repopulates the cache.
   *
   * The port behind this is the failover chain, so by the time a fetch throws,
   * *every* configured exchange has already been tried and logged. Only then
   * is a still-cached (even if expired) value served rather than failing the
   * request — and it is returned with its original `fetchedAt` and
   * `isStale: true`, never dressed up as a fresh read. A failed fetch does not
   * touch the cache, so a good value is never overwritten by an outage. With
   * no cached value at all, the provider error is rethrown.
   */
  async execute(): Promise<UsdtTomanSnapshot> {
    const cached = this.cache.get();
    if (cached) {
      return { ...cached.value, fetchedAt: cached.fetchedAt, isStale: false };
    }

    try {
      const fresh = await this.provider.fetchUsdtTomanRate();
      const cached = this.cache.set(fresh);
      return { ...cached.value, fetchedAt: cached.fetchedAt, isStale: false };
    } catch (error) {
      const stale = this.cache.getStale();

      if (stale) {
        this.logger.warn(
          { err: error, provider: stale.value.provider },
          'All USDT rate providers failed; serving stale cached value'
        );
        return { ...stale.value, fetchedAt: stale.fetchedAt, isStale: true };
      }

      throw error;
    }
  }
}
