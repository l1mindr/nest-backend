import {
  compareDecimals,
  divideDecimals,
  multiplyDecimals,
  subtractDecimals,
  sumDecimals
} from '@core/decimal/decimal.util';
import { CostBasisCalculator } from './cost-basis.calculator';
import {
  assertFee,
  assertOpeningCost,
  assertOpeningQuantity,
  assertOptionalPrice,
  assertPositiveAmount,
  assertSupportedType,
  requirePrice
} from './cost-basis-validation';
import { CalculationErrors } from './errors/calculation-errors';
import { CALCULATION_DIVISION_MAX_FRACTION_DIGITS } from './portfolio-calculation.constants';
import { CostBasisOpeningState } from './types/calculation-input.types';
import {
  CostBasisResult,
  RealizedPnlEvent
} from './types/calculation-result.types';
import {
  CalculationTransaction,
  CalculationTransactionType
} from './types/calculation-transaction.types';

/**
 * Average-cost strategy.
 *
 * All acquisition cost is pooled. A disposal releases a proportional share of
 * the pool — `amount × (totalCost / quantityBefore)` — so the average cost of
 * the remaining position is unchanged:
 * - BUY:          quantity += amount, totalCost += amount × price.
 * - SELL:         releases cost basis and records a realized P&L event.
 * - TRANSFER_IN:  quantity += amount; never creates acquisition cost.
 * - TRANSFER_OUT: releases cost basis like a SELL but is a custody move and
 *   records no realized P&L event.
 *
 * Fees are validated and preserved separately; they are never added to
 * `totalCost`, and realized P&L is reported gross of the disposal fee (the
 * fee is carried on the event for the application layer to net).
 *
 * All arithmetic goes through the exact decimal utility — no JavaScript
 * floating-point values are involved. Unsupported types, malformed decimals,
 * negative values, and disposals exceeding the available quantity fail
 * deterministically with a domain error.
 *
 * Disposal release recomputes `averageCost = totalCost / quantity` on every
 * disposal; the previous result cannot be reused. The released basis is
 * `amount × trunc26(totalCost / quantity)`, so after the disposal the exact
 * `totalCost` and `quantity` no longer scale in exact proportion and the next
 * average can drift by one unit in the last place. The single provable
 * exception is a zero-cost position, where the average is `0` regardless of
 * quantity; `releaseProportionalBasis` skips that redundant division.
 */
export class AverageCostCalculator implements CostBasisCalculator {
  calculate(
    transactions: CalculationTransaction[],
    opening: CostBasisOpeningState
  ): CostBasisResult {
    let quantity = assertOpeningQuantity(opening.quantity);
    let totalCost = assertOpeningCost(opening.totalCost);
    const realizedPnl: RealizedPnlEvent[] = [];

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
          const price = requirePrice(transaction.price, transaction.type);
          const sold = this.clampDisposal(quantity, amount);
          const releasedBasis = this.releaseProportionalBasis(
            totalCost,
            quantity,
            sold
          );
          const proceeds = multiplyDecimals(sold, price);
          quantity = subtractDecimals(quantity, sold);
          totalCost = subtractDecimals(totalCost, releasedBasis);
          realizedPnl.push({
            transactionId: transaction.id,
            occurredAt: transaction.occurredAt,
            type: CalculationTransactionType.SELL,
            amount: sold,
            price,
            proceeds,
            releasedCostBasis: releasedBasis,
            realizedPnl: subtractDecimals(proceeds, releasedBasis),
            fee: transaction.fee
          });
          break;
        }
        case CalculationTransactionType.TRANSFER_IN: {
          assertOptionalPrice(transaction.price);
          quantity = sumDecimals([quantity, amount]);
          break;
        }
        case CalculationTransactionType.TRANSFER_OUT: {
          assertOptionalPrice(transaction.price);
          const transferred = this.clampDisposal(quantity, amount);
          const releasedBasis = this.releaseProportionalBasis(
            totalCost,
            quantity,
            transferred
          );
          quantity = subtractDecimals(quantity, transferred);
          totalCost = subtractDecimals(totalCost, releasedBasis);
          break;
        }
      }
    }

    return { quantity, totalCost, realizedPnl };
  }

  /**
   * Releases the proportional share of the pooled cost for a disposal.
   *
   * The average is recomputed from the current `totalCost`/`quantity` pair.
   * Memoizing the previous disposal's average is unsafe: the released basis is
   * `amount × trunc26(totalCost / quantity)`, so the remaining `totalCost` and
   * `quantity` do not scale exactly and the next average can differ. The one
   * exact shortcut is a zero-cost position — the average `0 / quantity` is
   * provably `0` — where the division is skipped entirely.
   */
  private releaseProportionalBasis(
    totalCost: string,
    quantity: string,
    amount: string
  ): string {
    if (
      compareDecimals(totalCost, '0') === 0 ||
      compareDecimals(amount, '0') === 0
    ) {
      return '0';
    }

    const averageCost = divideDecimals(
      totalCost,
      quantity,
      CALCULATION_DIVISION_MAX_FRACTION_DIGITS
    );
    return multiplyDecimals(amount, averageCost);
  }

  /**
   * Clamps a disposal to the quantity actually held. A disposal may not exceed
   * the available inventory, so any excess (the result of an oversell created
   * before transaction-side validation existed) is ignored rather than
   * rejected: realized quantity/cost/proceeds are computed on the held amount
   * and the remaining quantity floors at zero.
   */
  private clampDisposal(quantity: string, amount: string): string {
    return compareDecimals(amount, quantity) > 0 ? quantity : amount;
  }
}
