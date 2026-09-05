import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { UsdtTomanEntry } from '../../application/interfaces/usdt-toman.interface';
import nobitexUsdtTomanConfig from '../nobitex/usdt-toman.config';

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
 * In-memory, per-replica TTL cache in front of the Nobitex market-stats call.
 * Same rationale as the CoinGecko caches: protect a third-party rate limit
 * without binding the widget to a slow background sync.
 */
@Injectable()
export class UsdtTomanCacheService {
  private entry: CacheEntry | null = null;

  constructor(
    @Inject(nobitexUsdtTomanConfig.KEY)
    private readonly config: ConfigType<typeof nobitexUsdtTomanConfig>
  ) {}

  get(): CachedEntry | null {
    if (!this.entry || this.entry.expiresAt <= Date.now()) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  getStale(): CachedEntry | null {
    if (!this.entry) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  /**
   * Returns what it stored, so a caller serving this value fresh reports the
   * same `fetchedAt` the cache will report for it on every later read. See
   * `FearGreedCacheService.set` — reading the clock again at the call site let
   * the two disagree by a millisecond.
   */
  set(value: UsdtTomanEntry): CachedEntry {
    const entry: CacheEntry = {
      value,
      fetchedAt: new Date(),
      expiresAt: Date.now() + this.config.cacheTtlMs
    };

    this.entry = entry;

    return { value: entry.value, fetchedAt: entry.fetchedAt };
  }
}
