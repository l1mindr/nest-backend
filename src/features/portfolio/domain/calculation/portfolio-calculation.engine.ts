import { compareDecimals, divideDecimals } from '@core/decimal/decimal.util';
import { AverageCostCalculator } from './average-cost.calculator';
import { CostBasisCalculator } from './cost-basis.calculator';
import { CalculationErrors } from './errors/calculation-errors';
import { CALCULATION_DIVISION_MAX_FRACTION_DIGITS } from './portfolio-calculation.constants';
import {
  CostBasisOpeningState,
  PortfolioCalculationInput
} from './types/calculation-input.types';
import { PortfolioCalculationResult } from './types/calculation-result.types';
import { CalculationTransaction } from './types/calculation-transaction.types';

/**
 * Pure, deterministic, framework-independent portfolio calculation engine.
 *
 * The engine validates and normalizes its input, orders the ledger
 * chronologically, delegates the cost-basis accumulation to a strategy, and
 * derives `averageCost` from the exact `totalCost`/`quantity` pair.
 *
 * It performs no I/O, no logging, no database or HTTP calls, and holds no
 * state between calls, so it can be reused unchanged from the REST API,
 * background jobs, a CLI, or scheduled analytics.
 *
 * The input arrays and transaction objects are never mutated.
 */
export class PortfolioCalculationEngine {
  constructor(
    private readonly costBasis: CostBasisCalculator = new AverageCostCalculator()
  ) {}

  calculate(input: PortfolioCalculationInput): PortfolioCalculationResult {
    if (
      !input ||
      typeof input !== 'object' ||
      !Array.isArray(input.transactions)
    ) {
      throw CalculationErrors.invalidInput();
    }

    for (const transaction of input.transactions) {
      if (!transaction || typeof transaction !== 'object') {
        throw CalculationErrors.invalidInput();
      }
      if (
        typeof transaction.occurredAt !== 'string' ||
        Number.isNaN(Date.parse(transaction.occurredAt))
      ) {
        throw CalculationErrors.invalidDate();
      }
    }

    const transactions = this.orderChronologically(input.transactions);

    const opening: CostBasisOpeningState = {
      quantity: input.openingQuantity ?? '0',
      totalCost: input.openingCost ?? '0'
    };

    const { quantity, totalCost, realizedPnl } = this.costBasis.calculate(
      transactions,
      opening
    );

    const averageCost =
      compareDecimals(quantity, '0') === 0
        ? '0'
        : divideDecimals(
            totalCost,
            quantity,
            CALCULATION_DIVISION_MAX_FRACTION_DIGITS
          );

    return { quantity, totalCost, averageCost, realizedPnl };
  }

  /**
   * Orders the ledger chronologically. Equal `occurredAt` values are resolved
   * by `id` (ascending), and exact ties fall back to the input order, which
   * `Array.prototype.sort` keeps stable. The source array is copied first.
   */
  private orderChronologically(
    transactions: CalculationTransaction[]
  ): CalculationTransaction[] {
    return [...transactions].sort((a, b) => {
      const timeDelta = this.compareOccurredAt(a, b);
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return this.compareById(a, b);
    });
  }

  private compareOccurredAt(
    a: CalculationTransaction,
    b: CalculationTransaction
  ): number {
    const aTime = Date.parse(a.occurredAt);
    const bTime = Date.parse(b.occurredAt);
    if (aTime < bTime) {
      return -1;
    }
    if (aTime > bTime) {
      return 1;
    }
    return 0;
  }

  private compareById(
    a: CalculationTransaction,
    b: CalculationTransaction
  ): number {
    const aId = a.id ?? '';
    const bId = b.id ?? '';
    if (aId < bId) {
      return -1;
    }
    if (aId > bId) {
      return 1;
    }
    return 0;
  }
}
