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
    if (transactions.length === 0) {
      return openingQuantity;
    }

    const amounts: { additions: string[]; subtractions: string[] } = {
      additions: openingQuantity === '0' ? [] : [openingQuantity],
      subtractions: []
    };

    for (const transaction of transactions) {
      switch (transaction.type) {
        case CalculationTransactionType.BUY:
        case CalculationTransactionType.TRANSFER_IN:
          amounts.additions.push(transaction.amount);
          break;

        case CalculationTransactionType.SELL:
        case CalculationTransactionType.TRANSFER_OUT:
          amounts.subtractions.push(transaction.amount);
          break;

        default:
          // Unknown transaction types are skipped
          break;
      }
    }

    // Calculate total additions
    const totalAdditions =
      amounts.additions.length === 0 ? '0' : sumDecimals(amounts.additions);

    // Calculate total subtractions
    const totalSubtractions =
      amounts.subtractions.length === 0
        ? '0'
        : sumDecimals(amounts.subtractions);

    // Calculate net: additions - subtractions
    return subtractDecimals(totalAdditions, totalSubtractions);
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
