export const BITCOIN_MARKET_PORT = Symbol('BitcoinMarketPort');

/**
 * Live Bitcoin/USD ticker as reported by the external market data source,
 * already mapped to the application's vocabulary. `priceUsd` is a decimal
 * string; `updatedAt` is when the provider itself last updated the price, not
 * when this application fetched it.
 *
 * Deliberately independent of `Asset.currentPrice` (the hourly-synced
 * catalogue snapshot `assets` persists): a dashboard "live price" widget must
 * not be bound to that sync interval.
 */
export interface BitcoinMarketEntry {
  priceUsd: string;
  priceChangePercentage24h: string;
  updatedAt: Date;
}

export interface BitcoinMarketPort {
  fetchBitcoinMarketData(): Promise<BitcoinMarketEntry>;
}

/**
 * A {@link BitcoinMarketEntry} plus freshness metadata about how this
 * particular response was served — see `GlobalMarketSnapshot` for the same
 * `fetchedAt`/`isStale` rationale.
 */
export interface BitcoinMarketSnapshot extends BitcoinMarketEntry {
  fetchedAt: Date;
  isStale: boolean;
}

export const GET_BITCOIN_MARKET_USE_CASE = Symbol('IGetBitcoinMarketUseCase');

export interface IGetBitcoinMarketUseCase {
  execute(): Promise<BitcoinMarketSnapshot>;
}
