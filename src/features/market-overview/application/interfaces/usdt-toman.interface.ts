export const USDT_TOMAN_PORT = Symbol('UsdtTomanPort');

/**
 * USDT quoted in Iranian Toman, already mapped to the application's
 * vocabulary. `priceToman` is a decimal string in **Toman** — the venue's
 * public market is priced in Rial and the provider divides, so nothing above
 * infrastructure has to know which unit the exchange quotes in.
 */
export interface UsdtTomanEntry {
  priceToman: string;
  /** 24h change of the Toman price, as a percentage. */
  priceChangePercentage24h: string;
  updatedAt: Date;
}

export interface UsdtTomanPort {
  fetchUsdtTomanRate(): Promise<UsdtTomanEntry>;
}

/**
 * A {@link UsdtTomanEntry} plus freshness metadata about how this particular
 * response was served — see `GlobalMarketSnapshot` for the same
 * `fetchedAt`/`isStale` rationale.
 */
export interface UsdtTomanSnapshot extends UsdtTomanEntry {
  fetchedAt: Date;
  isStale: boolean;
}

export const GET_USDT_TOMAN_USE_CASE = Symbol('IGetUsdtTomanUseCase');

export interface IGetUsdtTomanUseCase {
  execute(): Promise<UsdtTomanSnapshot>;
}
