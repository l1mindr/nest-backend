export const USDT_TOMAN_PORT = Symbol('UsdtTomanPort');

/**
 * USDT quoted in Iranian Toman, already mapped to the application's
 * vocabulary. `priceToman` is a decimal string in **Toman** — venues quote
 * either Rial or Toman and each adapter converts, so nothing above
 * infrastructure has to know which unit the exchange it came from uses.
 */
export interface UsdtTomanEntry {
  priceToman: string;
  /** 24h change of the Toman price, as a percentage. */
  priceChangePercentage24h: string;
  updatedAt: Date;
  /**
   * Which exchange adapter produced this rate. Carried through the cache and
   * out to the API so a rate can always be traced back to its venue — the
   * failover chain means the answer varies request to request.
   */
  provider: string;
}

export interface UsdtTomanPort {
  /**
   * Stable identifier for this upstream, used for provider selection and in
   * the failover logs. Matches the configured `USDT_TOMAN_PROVIDER` value.
   */
  readonly name: string;

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
