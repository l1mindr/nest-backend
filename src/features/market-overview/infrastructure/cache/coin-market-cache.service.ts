import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { CoinMarketEntry } from '../../application/interfaces/coin-market.interface';
import globalMarketConfig from '../coingecko/global-market.config';

interface CacheEntry {
  value: CoinMarketEntry;
  fetchedAt: Date;
  expiresAt: number;
}

/** The cached value together with when this backend fetched it. */
export interface CachedEntry {
  value: CoinMarketEntry;
  fetchedAt: Date;
}

/**
 * In-memory, per-replica TTL cache in front of the CoinGecko `/simple/price`
 * call. See `MarketOverviewCacheService` for the same rationale — a short
 * TTL here (shorter than the global-overview cache, since price is the most
 * time-sensitive of the market widgets) protects the external rate limit
 * without reintroducing the hourly-stale `assets` sync as the source.
 *
 * Keyed by coin id, so each ticker route expires on its own schedule and one
 * coin's fetch never serves another's price.
 */
@Injectable()
export class CoinMarketCacheService {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    @Inject(globalMarketConfig.KEY)
    private readonly config: ConfigType<typeof globalMarketConfig>
  ) {}

  get(coinId: string): CachedEntry | null {
    const entry = this.entries.get(coinId);

    if (!entry || entry.expiresAt <= Date.now()) return null;

    return { value: entry.value, fetchedAt: entry.fetchedAt };
  }

  getStale(coinId: string): CachedEntry | null {
    const entry = this.entries.get(coinId);

    if (!entry) return null;

    return { value: entry.value, fetchedAt: entry.fetchedAt };
  }

  /**
   * Returns what it stored, so a caller serving this value fresh reports the
   * same `fetchedAt` the cache will report for it on every later read. See
   * `FearGreedCacheService.set` — reading the clock again at the call site let
   * the two disagree by a millisecond.
   */
  set(coinId: string, value: CoinMarketEntry): CachedEntry {
    const entry: CacheEntry = {
      value,
      fetchedAt: new Date(),
      expiresAt: Date.now() + this.config.coinTickerCacheTtlMs
    };

    this.entries.set(coinId, entry);

    return { value: entry.value, fetchedAt: entry.fetchedAt };
  }
}
