import {
  compareDecimals,
  divideDecimals,
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
import { LotStore } from './lot';
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
 * Lot-based cost-basis accounting shared by the FIFO and LIFO strategies.
 *
 * Each acquisition creates a lot; a SELL or TRANSFER_OUT consumes lots from
 * one end of the queue and releases their exact cost basis. TRANSFER_IN
 * creates a zero-cost lot (transfers never create acquisition cost), and only
 * SELL produces realized P&L — transfers are custody moves.
 *
 * The opening position is treated as a single lot whose `unitCost` is
 * `openingCost / openingQuantity` (the only place division appears; BUY lots
 * carry their exact price). If the opening quantity is zero, no opening lot
 * exists.
 *
 * All arithmetic goes through the exact decimal utility. Unsupported types,
 * malformed decimals, negative values, and disposals exceeding the available
 * quantity fail deterministically with a domain error.
 */
export abstract class LotCostBasisCalculator implements CostBasisCalculator {
  protected constructor(private readonly fromBack: boolean) {}

  calculate(
    transactions: CalculationTransaction[],
    opening: CostBasisOpeningState
  ): CostBasisResult {
    const openingQuantity = assertOpeningQuantity(opening.quantity);
    const openingCost = assertOpeningCost(opening.totalCost);

    const lots = new LotStore(this.fromBack);

    if (opening.lots && opening.lots.length > 0) {
      // Resume from a checkpointed lot queue — push the exact surviving lots
      // without averaging, so FIFO/LIFO disposal order is preserved exactly.
      for (const lot of opening.lots) {
        lots.push(lot);
      }
    } else if (compareDecimals(openingQuantity, '0') > 0) {
      // Fresh start from an averaged opening position (opening balance only).
      lots.push({
        quantity: openingQuantity,
        unitCost: divideDecimals(
          openingCost,
          openingQuantity,
          CALCULATION_DIVISION_MAX_FRACTION_DIGITS
        )
      });
    }

    let quantity = openingQuantity;
    let totalCost = openingCost;
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
          lots.push({ quantity: amount, unitCost: price });
          quantity = sumDecimals([quantity, amount]);
          totalCost = sumDecimals([totalCost, multiplyDecimals(amount, price)]);
          break;
        }
        case CalculationTransactionType.SELL: {
          const price = requirePrice(transaction.price, transaction.type);
          assertAvailable(quantity, amount);
          const releasedBasis = lots.consume(amount);
          const proceeds = multiplyDecimals(amount, price);
          quantity = subtractDecimals(quantity, amount);
          totalCost = subtractDecimals(totalCost, releasedBasis);
          realizedPnl.push({
            transactionId: transaction.id,
            occurredAt: transaction.occurredAt,
            type: CalculationTransactionType.SELL,
            amount,
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
          lots.push({ quantity: amount, unitCost: '0' });
          quantity = sumDecimals([quantity, amount]);
          break;
        }
        case CalculationTransactionType.TRANSFER_OUT: {
          assertOptionalPrice(transaction.price);
          assertAvailable(quantity, amount);
          const releasedBasis = lots.consume(amount);
          quantity = subtractDecimals(quantity, amount);
          totalCost = subtractDecimals(totalCost, releasedBasis);
          break;
        }
      }
    }

    return { quantity, totalCost, realizedPnl, lots: lots.toLots() };
  }
}

/**
 * FIFO (first-in-first-out) strategy: disposals consume the oldest lots first.
 */
export class FifoCostBasisCalculator extends LotCostBasisCalculator {
  constructor() {
    super(false);
  }
}

/**
 * LIFO (last-in-first-out) strategy: disposals consume the newest lots first.
 */
export class LifoCostBasisCalculator extends LotCostBasisCalculator {
  constructor() {
    super(true);
  }
}
