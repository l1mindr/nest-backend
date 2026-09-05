export const COIN_MARKET_PORT = Symbol('CoinMarketPort');

/**
 * Live coin/USD ticker as reported by the external market data source,
 * already mapped to the application's vocabulary. `priceUsd` is a decimal
 * string; `updatedAt` is when the provider itself last updated the price, not
 * when this application fetched it.
 *
 * Deliberately independent of `Asset.currentPrice` (the hourly-synced
 * catalogue snapshot `assets` persists): a dashboard "live price" widget must
 * not be bound to that sync interval.
 */
export interface CoinMarketEntry {
  priceUsd: string;
  priceChangePercentage24h: string;
  updatedAt: Date;
}

export interface CoinMarketPort {
  /** @param coinId The provider's own coin id, e.g. `bitcoin`, `ethereum`. */
  fetchCoinMarketData(coinId: string): Promise<CoinMarketEntry>;
}

/**
 * A {@link CoinMarketEntry} plus freshness metadata about how this particular
 * response was served — see `GlobalMarketSnapshot` for the same
 * `fetchedAt`/`isStale` rationale.
 */
export interface CoinMarketSnapshot extends CoinMarketEntry {
  fetchedAt: Date;
  isStale: boolean;
}

export const GET_COIN_MARKET_USE_CASE = Symbol('IGetCoinMarketUseCase');

export interface IGetCoinMarketUseCase {
  execute(coinId: string): Promise<CoinMarketSnapshot>;
}

/**
 * The coins this API exposes a live ticker route for. Keeping them named in
 * one place stops a controller inventing a provider id that the upstream does
 * not recognise.
 */
export const TICKER_COIN_IDS = {
  BITCOIN: 'bitcoin',
  ETHEREUM: 'ethereum'
} as const;
