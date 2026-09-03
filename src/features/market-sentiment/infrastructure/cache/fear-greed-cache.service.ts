import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { FearGreedEntry } from '../../application/interfaces/market-sentiment.interface';
import fearGreedConfig from '../alternativeme/fear-greed.config';

interface CacheEntry {
  value: FearGreedEntry;
  fetchedAt: Date;
  expiresAt: number;
}

/** The cached value together with when this backend fetched it. */
export interface CachedEntry {
  value: FearGreedEntry;
  fetchedAt: Date;
}

/**
 * In-memory, per-replica TTL cache in front of the alternative.me call. See
 * `MarketOverviewCacheService` for the same rationale — a single denormalized
 * value with no per-user variation does not warrant a DB-persisted sync job.
 * The index itself only changes roughly once a day upstream, so the default
 * TTL here is much longer than the market-overview cache's.
 */
@Injectable()
export class FearGreedCacheService {
  private entry: CacheEntry | null = null;

  constructor(
    @Inject(fearGreedConfig.KEY)
    private readonly config: ConfigType<typeof fearGreedConfig>
  ) {}

  get(): CachedEntry | null {
    if (!this.entry || this.entry.expiresAt <= Date.now()) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  getStale(): CachedEntry | null {
    if (!this.entry) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  set(value: FearGreedEntry): void {
    this.entry = {
      value,
      fetchedAt: new Date(),
      expiresAt: Date.now() + this.config.cacheTtlMs
    };
  }
}
