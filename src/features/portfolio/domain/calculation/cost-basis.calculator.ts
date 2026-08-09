import {
  compareDecimals,
  isDecimalString,
  multiplyDecimals,
  subtractDecimals,
  sumDecimals
} from '@core/decimal/decimal.util';
import { CalculationErrors } from './errors/calculation-errors';
import { CostBasisOpeningState } from './types/calculation-input.types';
import { CostBasisResult } from './types/calculation-result.types';
import {
  CalculationTransaction,
  CalculationTransactionType
} from './types/calculation-transaction.types';

/**
 * Abstraction over cost-basis strategies. Future milestones can add FIFO and
 * LIFO implementations without touching the transaction vocabulary, the
 * engine, or the repository layer.
 */
export interface CostBasisCalculator {
  /**
   * Processes a chronologically ordered transaction list against an opening
   * state and returns the exact resulting quantity and total acquisition
   * cost. The transactions are never mutated.
   */
  calculate(
    transactions: CalculationTransaction[],
    opening: CostBasisOpeningState
  ): CostBasisResult;
}

/**
 * Average-cost strategy foundation.
 *
 * Semantics (M6.1):
 * - BUY:          quantity += amount, totalCost += amount × price.
 * - SELL:         quantity -= amount; totalCost is untouched — releasing cost
 *   basis on disposal is part of the realized-P&L policy, which is deferred.
 * - TRANSFER_IN:  quantity += amount; never creates acquisition cost.
 * - TRANSFER_OUT: quantity -= amount; never creates a sale or realized P&L.
 *
 * Fees are validated and preserved separately; they are never added to
 * `totalCost` (the realized-P&L milestone decides their accounting treatment).
 *
 * All arithmetic goes through the exact decimal utility — no JavaScript
 * floating-point values are involved. Unsupported types, malformed decimals,
 * negative values, and sells exceeding the available quantity fail
 * deterministically with a domain error.
 */
export class AverageCostCalculator implements CostBasisCalculator {
  calculate(
    transactions: CalculationTransaction[],
    opening: CostBasisOpeningState
  ): CostBasisResult {
    let quantity = this.assertOpeningQuantity(opening.quantity);
    let totalCost = this.assertOpeningCost(opening.totalCost);

    for (const transaction of transactions) {
      if (!transaction || typeof transaction !== 'object') {
        throw CalculationErrors.invalidInput();
      }

      if (!this.isSupportedType(transaction.type)) {
        throw CalculationErrors.unsupportedTransactionType(transaction.type);
      }

      const amount = this.assertPositiveAmount(transaction.amount);
      this.assertFee(transaction.fee);

      switch (transaction.type) {
        case CalculationTransactionType.BUY: {
          const price = this.requirePrice(transaction.price, transaction.type);
          quantity = sumDecimals([quantity, amount]);
          totalCost = sumDecimals([totalCost, multiplyDecimals(amount, price)]);
          break;
        }
        case CalculationTransactionType.SELL: {
          this.requirePrice(transaction.price, transaction.type);
          quantity = this.decreaseQuantity(quantity, amount);
          break;
        }
        case CalculationTransactionType.TRANSFER_IN: {
          this.assertOptionalPrice(transaction.price);
          quantity = sumDecimals([quantity, amount]);
          break;
        }
        case CalculationTransactionType.TRANSFER_OUT: {
          this.assertOptionalPrice(transaction.price);
          quantity = this.decreaseQuantity(quantity, amount);
          break;
        }
      }
    }

    return { quantity, totalCost };
  }

  private isSupportedType(type: unknown): type is CalculationTransactionType {
    return (
      type === CalculationTransactionType.BUY ||
      type === CalculationTransactionType.SELL ||
      type === CalculationTransactionType.TRANSFER_IN ||
      type === CalculationTransactionType.TRANSFER_OUT
    );
  }

  private assertOpeningQuantity(value: string): string {
    if (!isDecimalString(value)) {
      throw CalculationErrors.invalidDecimal('openingQuantity');
    }
    if (compareDecimals(value, '0') < 0) {
      throw CalculationErrors.negativeQuantity();
    }
    return value;
  }

  private assertOpeningCost(value: string): string {
    if (!isDecimalString(value)) {
      throw CalculationErrors.invalidDecimal('openingCost');
    }
    if (compareDecimals(value, '0') < 0) {
      throw CalculationErrors.negativeAmount();
    }
    return value;
  }

  private assertPositiveAmount(amount: string): string {
    if (!isDecimalString(amount)) {
      throw CalculationErrors.invalidDecimal('amount');
    }
    if (compareDecimals(amount, '0') <= 0) {
      throw CalculationErrors.negativeAmount();
    }
    return amount;
  }

  private requirePrice(
    price: string | undefined,
    type: CalculationTransactionType
  ): string {
    if (price === undefined) {
      throw CalculationErrors.missingPrice(type);
    }
    if (!isDecimalString(price)) {
      throw CalculationErrors.invalidDecimal('price');
    }
    if (compareDecimals(price, '0') <= 0) {
      throw CalculationErrors.negativePrice();
    }
    return price;
  }

  private assertOptionalPrice(price: string | undefined): void {
    if (price === undefined) {
      return;
    }
    if (!isDecimalString(price)) {
      throw CalculationErrors.invalidDecimal('price');
    }
    if (compareDecimals(price, '0') <= 0) {
      throw CalculationErrors.negativePrice();
    }
  }

  private assertFee(fee: string | undefined): void {
    if (fee === undefined) {
      return;
    }
    if (!isDecimalString(fee)) {
      throw CalculationErrors.invalidDecimal('fee');
    }
    if (compareDecimals(fee, '0') < 0) {
      throw CalculationErrors.negativeFee();
    }
  }

  private decreaseQuantity(quantity: string, amount: string): string {
    if (compareDecimals(amount, quantity) > 0) {
      throw CalculationErrors.insufficientQuantity();
    }
    return subtractDecimals(quantity, amount);
  }
}
