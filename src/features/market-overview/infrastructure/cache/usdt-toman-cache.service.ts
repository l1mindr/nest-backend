import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { UsdtTomanEntry } from '../../application/interfaces/usdt-toman.interface';
import usdtTomanConfig from '../usdt-toman/usdt-toman.config';

interface CacheEntry {
  value: UsdtTomanEntry;
  fetchedAt: Date;
  expiresAt: number;
}

/** The cached value together with when this backend fetched it. */
export interface CachedEntry {
  value: UsdtTomanEntry;
  fetchedAt: Date;
}

/**
 * In-memory, per-replica TTL cache in front of the USDT/Toman failover chain.
 * Same rationale as the CoinGecko caches: protect a third-party rate limit
 * without binding the widget to a slow background sync.
 *
 * One cache for the whole chain rather than one per exchange. Both venues
 * answer the same question in the same unit, so a rate that came from the
 * fallback is just as cacheable as one from the preferred venue — and a second
 * layer per provider would only add a way for the two to disagree. Which venue
 * supplied the cached rate travels on the entry's own `provider` field.
 *
 * Only a successful fetch reaches {@link set}, so a failing provider can never
 * overwrite a good value; the use case decides separately whether to serve an
 * expired entry, and marks it stale when it does.
 */
@Injectable()
export class UsdtTomanCacheService {
  private entry: CacheEntry | null = null;

  constructor(
    @Inject(usdtTomanConfig.KEY)
    private readonly config: ConfigType<typeof usdtTomanConfig>
  ) {}

  get(): CachedEntry | null {
    if (!this.entry || this.entry.expiresAt <= Date.now()) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  getStale(): CachedEntry | null {
    if (!this.entry) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  set(value: UsdtTomanEntry): void {
    this.entry = {
      value,
      fetchedAt: new Date(),
      expiresAt: Date.now() + this.config.cacheTtlMs
    };
  }
}
