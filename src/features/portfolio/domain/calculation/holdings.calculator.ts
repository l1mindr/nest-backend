import {
  compareDecimals,
  subtractDecimals,
  sumDecimals
} from '@core/decimal/decimal.util';
import {
  CalculationTransaction,
  CalculationTransactionType
} from './types/calculation-transaction.types';

/**
 * Holdings calculator - computes current holdings from a transaction ledger.
 *
 * This is the single source of truth for portfolio holdings.
 *
 * Holdings are calculated by processing transactions in chronological order:
 * - BUY: add to holdings
 * - TRANSFER_IN: add to holdings
 * - SELL: subtract from holdings
 * - TRANSFER_OUT: subtract from holdings
 *
 * The calculator operates on decimal precision and never mutates input.
 */
export class HoldingsCalculator {
  /**
   * Calculate current holdings for a specific asset from its transaction history.
   *
   * @param transactions - Transaction ledger in chronological order for a single asset
   * @param openingQuantity - Initial quantity (e.g., from PortfolioOpeningBalance), defaults to 0
   * @returns Current holding quantity as a decimal string
   */
  calculateQuantity(
    transactions: CalculationTransaction[],
    openingQuantity: string = '0'
  ): string {
    let quantity = openingQuantity;

    // Processed transaction-by-transaction (the ledger is already supplied in
    // chronological order) rather than as one bulk sum-then-subtract, so each
    // disposal can be clamped individually — see `clampDisposal`. Order matters
    // once clamping is involved: BUY 10 → SELL 50 → BUY 5 must floor at zero
    // after the oversold SELL and then pick back up, which a single final
    // `totalAdditions - totalSubtractions` cannot express.
    for (const transaction of transactions) {
      switch (transaction.type) {
        case CalculationTransactionType.BUY:
        case CalculationTransactionType.TRANSFER_IN:
          quantity = sumDecimals([quantity, transaction.amount]);
          break;

        case CalculationTransactionType.SELL:
        case CalculationTransactionType.TRANSFER_OUT:
          quantity = subtractDecimals(
            quantity,
            this.clampDisposal(quantity, transaction.amount)
          );
          break;

        default:
          // Unknown transaction types are skipped
          break;
      }
    }

    return quantity;
  }

  /**
   * Clamps a disposal to the quantity actually held, mirroring
   * `AverageCostCalculator.clampDisposal`: a holding can never be negative — you
   * cannot hold −40 units of a coin — so a disposal may not drive the running
   * quantity below zero. Any excess (the result of an oversell created before
   * transaction-side validation existed, e.g. seeded or migrated data) is
   * ignored rather than propagated; the position floors at zero for that
   * disposal instead of going negative and later failing `multiplyDecimals`'s
   * non-negative guard in valuation.
   */
  private clampDisposal(quantity: string, amount: string): string {
    return compareDecimals(amount, quantity) > 0 ? quantity : amount;
  }

  /**
   * Validate that a SELL or TRANSFER_OUT transaction is allowed.
   *
   * @param currentQuantity - Current holding quantity
   * @param sellQuantity - Amount to sell/transfer out
   * @returns true if valid (currentQuantity >= sellQuantity), false otherwise
   */
  validateSell(currentQuantity: string, sellQuantity: string): boolean {
    const comparison = compareDecimals(currentQuantity, sellQuantity);
    // comparison >= 0 means currentQuantity >= sellQuantity
    return comparison >= 0;
  }
}
