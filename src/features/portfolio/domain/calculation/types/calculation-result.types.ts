import { CalculationTransactionType } from './calculation-transaction.types';

/**
 * A single realized P&L event produced by a SELL disposal.
 *
 * All monetary values are exact decimal strings. P&L is reported gross of
 * fees: `proceeds` is `amount × price`, the transaction fee is carried
 * through unchanged, and the application layer decides how to net it.
 */
export interface RealizedPnlEvent {
  /** Opaque id of the SELL transaction that produced the event. */
  transactionId?: string;
  /** ISO 8601 timestamp of the disposal. */
  occurredAt: string;
  /** Only SELL disposals realize P&L; transfers are custody moves. */
  type: CalculationTransactionType.SELL;
  /** Quantity disposed, as a decimal string. */
  amount: string;
  /** Unit price of the disposal, as a decimal string. */
  price: string;
  /** Gross proceeds (`amount × price`), as a decimal string. */
  proceeds: string;
  /** Acquisition cost released from the position, as a decimal string. */
  releasedCostBasis: string;
  /** Signed realized gain (`proceeds − releasedCostBasis`). */
  realizedPnl: string;
  /** Fee carried through for the application layer; never netted here. */
  fee?: string;
}

/**
 * The exact state produced by a cost-basis strategy. All values are decimal
 * strings and are never rounded.
 */
export interface CostBasisResult {
  /** Quantity held after processing the transactions, as a decimal string. */
  quantity: string;
  /** Accumulated acquisition cost, as a decimal string. */
  totalCost: string;
  /** Realized P&L events, in chronological processing order. Empty when no SELL occurred. */
  realizedPnl: RealizedPnlEvent[];
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
  realizedPnl: RealizedPnlEvent[];
}
