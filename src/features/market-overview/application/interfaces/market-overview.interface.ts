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

export const GET_MARKET_OVERVIEW_USE_CASE = Symbol('IGetMarketOverviewUseCase');

export interface IGetMarketOverviewUseCase {
  execute(): Promise<GlobalMarketDataEntry>;
}
