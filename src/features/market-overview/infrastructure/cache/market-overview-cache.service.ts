import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { GlobalMarketDataEntry } from '../../application/interfaces/market-overview.interface';
import globalMarketConfig from '../coingecko/global-market.config';

interface CacheEntry {
  value: GlobalMarketDataEntry;
  fetchedAt: Date;
  expiresAt: number;
}

/** The cached value together with when this backend fetched it. */
export interface CachedEntry {
  value: GlobalMarketDataEntry;
  fetchedAt: Date;
}

/**
 * In-memory, per-replica TTL cache in front of the CoinGecko `/global` call.
 *
 * Global market cap is a single denormalized value with no per-user
 * variation and no audit requirement, so a full BullMQ-scheduled sync into
 * Postgres (the pattern `assets` uses for the per-coin catalogue) would be
 * disproportionate here. The accepted tradeoff: each backend replica keeps
 * its own cache, so under N replicas CoinGecko can be called up to N times
 * per TTL window — acceptable for a public dashboard widget's request volume.
 */
@Injectable()
export class MarketOverviewCacheService {
  private entry: CacheEntry | null = null;

  constructor(
    @Inject(globalMarketConfig.KEY)
    private readonly config: ConfigType<typeof globalMarketConfig>
  ) {}

  /** Returns the cached value and when it was fetched, only while still fresh. */
  get(): CachedEntry | null {
    if (!this.entry || this.entry.expiresAt <= Date.now()) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  /** Returns the cached value regardless of freshness, for failure fallback. */
  getStale(): CachedEntry | null {
    if (!this.entry) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  set(value: GlobalMarketDataEntry): CachedEntry {
    const entry: CacheEntry = {
      value,
      fetchedAt: new Date(),
      expiresAt: Date.now() + this.config.cacheTtlMs
    };

    this.entry = entry;

    return { value: entry.value, fetchedAt: entry.fetchedAt };
  }
}
