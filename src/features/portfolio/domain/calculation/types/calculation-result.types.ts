/**
 * The exact state produced by a cost-basis strategy. Both values are decimal
 * strings and are never rounded.
 */
export interface CostBasisResult {
  /** Quantity held after processing the transactions, as a decimal string. */
  quantity: string;
  /** Accumulated acquisition cost, as a decimal string. */
  totalCost: string;
}

/**
 * The result of a portfolio calculation.
 *
 * All monetary and quantity values are decimal strings computed with exact
 * (BigInt-based) arithmetic — never through a JavaScript number. Nullable
 * values are avoided: `averageCost` is `'0'` when `quantity` is zero.
 */
export interface PortfolioCalculationResult {
  quantity: string;
  totalCost: string;
  averageCost: string;
}
