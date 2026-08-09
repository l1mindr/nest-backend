import {
  multiplyDecimals,
  subtractDecimals,
  sumDecimals
} from '@core/decimal/decimal.util';
import { CostBasisCalculator } from './cost-basis.calculator';
import {
  assertAvailable,
  assertFee,
  assertOpeningCost,
  assertOpeningQuantity,
  assertOptionalPrice,
  assertPositiveAmount,
  assertSupportedType,
  requirePrice
} from './cost-basis-validation';
import { CalculationErrors } from './errors/calculation-errors';
import { CostBasisOpeningState } from './types/calculation-input.types';
import { CostBasisResult } from './types/calculation-result.types';
import {
  CalculationTransaction,
  CalculationTransactionType
} from './types/calculation-transaction.types';

/**
 * Average-cost strategy.
 *
 * Semantics:
 * - BUY:          quantity += amount, totalCost += amount × price.
 * - SELL:         quantity -= amount; totalCost is untouched — releasing cost
 *   basis on disposal is part of the realized-P&L policy.
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
    let quantity = assertOpeningQuantity(opening.quantity);
    let totalCost = assertOpeningCost(opening.totalCost);

    for (const transaction of transactions) {
      if (!transaction || typeof transaction !== 'object') {
        throw CalculationErrors.invalidInput();
      }

      assertSupportedType(transaction.type);

      const amount = assertPositiveAmount(transaction.amount);
      assertFee(transaction.fee);

      switch (transaction.type) {
        case CalculationTransactionType.BUY: {
          const price = requirePrice(transaction.price, transaction.type);
          quantity = sumDecimals([quantity, amount]);
          totalCost = sumDecimals([totalCost, multiplyDecimals(amount, price)]);
          break;
        }
        case CalculationTransactionType.SELL: {
          requirePrice(transaction.price, transaction.type);
          assertAvailable(quantity, amount);
          quantity = subtractDecimals(quantity, amount);
          break;
        }
        case CalculationTransactionType.TRANSFER_IN: {
          assertOptionalPrice(transaction.price);
          quantity = sumDecimals([quantity, amount]);
          break;
        }
        case CalculationTransactionType.TRANSFER_OUT: {
          assertOptionalPrice(transaction.price);
          assertAvailable(quantity, amount);
          quantity = subtractDecimals(quantity, amount);
          break;
        }
      }
    }

    return { quantity, totalCost };
  }
}
