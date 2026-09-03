import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { BitcoinMarketEntry } from '../../application/interfaces/bitcoin-market.interface';
import globalMarketConfig from '../coingecko/global-market.config';

interface CacheEntry {
  value: BitcoinMarketEntry;
  fetchedAt: Date;
  expiresAt: number;
}

/** The cached value together with when this backend fetched it. */
export interface CachedEntry {
  value: BitcoinMarketEntry;
  fetchedAt: Date;
}

/**
 * In-memory, per-replica TTL cache in front of the CoinGecko `/simple/price`
 * call. See `MarketOverviewCacheService` for the same rationale — a short
 * TTL here (shorter than the global-overview cache, since price is the most
 * time-sensitive of the three market widgets) protects the external rate
 * limit without reintroducing the hourly-stale `assets` sync as the source.
 */
@Injectable()
export class BitcoinCacheService {
  private entry: CacheEntry | null = null;

  constructor(
    @Inject(globalMarketConfig.KEY)
    private readonly config: ConfigType<typeof globalMarketConfig>
  ) {}

  get(): CachedEntry | null {
    if (!this.entry || this.entry.expiresAt <= Date.now()) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  getStale(): CachedEntry | null {
    if (!this.entry) return null;
    return { value: this.entry.value, fetchedAt: this.entry.fetchedAt };
  }

  set(value: BitcoinMarketEntry): void {
    this.entry = {
      value,
      fetchedAt: new Date(),
      expiresAt: Date.now() + this.config.bitcoinCacheTtlMs
    };
  }
}
