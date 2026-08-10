import { CalculationTransaction } from './calculation-transaction.types';

/**
 * The opening cost-basis state a cost-basis strategy starts from, typically
 * carried in from a period before the supplied transaction window.
 */
export interface CostBasisOpeningState {
  /** Quantity already held before the window, as a non-negative decimal string. */
  quantity: string;
  /** Acquisition cost already accumulated before the window, as a non-negative decimal string. */
  totalCost: string;
}

/**
 * The normalized input to the portfolio calculation engine.
 *
 * The engine is pure and framework-independent: it receives plain domain
 * values and knows nothing about repositories, DTOs, HTTP or users.
 *
 * `currentPrice` is deliberately absent: the application layer supplies market
 * prices when unrealized-P&L/valuation calculations are introduced (M6.3).
 */
export interface PortfolioCalculationInput {
  /**
   * Opaque asset context. Not used by the calculation; it documents that the
   * engine always operates on a single asset.
   */
  assetId?: string;
  /**
   * Quantity held before the transaction window, as a non-negative decimal
   * string. Defaults to `'0'`.
   */
  openingQuantity?: string;
  /**
   * Acquisition cost accumulated before the transaction window, as a
   * non-negative decimal string. Defaults to `'0'`.
   */
  openingCost?: string;
  /**
   * The ledger to process. Chronological ordering is NOT required by default:
   * the engine sorts deterministically by `occurredAt` and, for equal
   * timestamps, by `id`. Callers that already guarantee that ordering can opt
   * out via `PortfolioCalculationOptions`. The input array and its
   * transactions are never mutated.
   */
  transactions: CalculationTransaction[];
}

/**
 * Optional processing directives for the calculation engine.
 *
 * Every flag is explicitly opt-in and off by default, so untrusted callers
 * keep the full validate-and-sort behavior. The trusted P&L path opts in
 * because its repository returns transactions ordered by `occurredAt` then
 * `id`, and its mapper emits normalized ISO timestamps.
 */
export interface PortfolioCalculationOptions {
  /**
   * When true, the engine assumes `transactions` is already ordered by
   * `occurredAt` (ascending) with `id` as the deterministic tie-breaker for
   * identical timestamps, and skips its internal chronological sort. The
   * `id` tie-breaker remains part of the assumed ordering contract.
   */
  alreadyOrdered?: boolean;
  /**
   * When true, the engine assumes every `occurredAt` is a valid normalized ISO
   * timestamp and skips `Date.parse` validation. The default path still
   * validates every date.
   */
  trustedIsoDates?: boolean;
}
