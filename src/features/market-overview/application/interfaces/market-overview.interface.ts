export const GLOBAL_MARKET_DATA_PORT = Symbol('GlobalMarketDataPort');

/**
 * Total crypto market snapshot as reported by the external market data
 * source, already mapped to the application's vocabulary. Decimal quantities
 * are decimal strings; `updatedAt` is when the provider itself last computed
 * the snapshot, not when this application fetched it.
 */
export interface GlobalMarketDataEntry {
  totalMarketCapUsd: string;
  marketCapChangePercentage24h: string;
  btcDominancePercentage: string;
  updatedAt: Date;
}

export interface GlobalMarketDataPort {
  fetchGlobalMarketData(): Promise<GlobalMarketDataEntry>;
}

/**
 * A {@link GlobalMarketDataEntry} plus freshness metadata about how this
 * particular response was served. `fetchedAt` is when *this backend* last
 * successfully called the provider (i.e. when the cache entry being served
 * was populated) — distinct from `updatedAt`, which is when the provider
 * itself computed the snapshot. `isStale` is true only when the provider call
 * for this request failed and a previously-cached value was served instead of
 * failing the request outright.
 */
export interface GlobalMarketSnapshot extends GlobalMarketDataEntry {
  fetchedAt: Date;
  isStale: boolean;
}

export const GET_MARKET_OVERVIEW_USE_CASE = Symbol('IGetMarketOverviewUseCase');

export interface IGetMarketOverviewUseCase {
  execute(): Promise<GlobalMarketSnapshot>;
}
