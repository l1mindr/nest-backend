import { compareDecimals, divideDecimals } from '@core/decimal/decimal.util';
import { AverageCostCalculator } from './average-cost.calculator';
import { CostBasisCalculator } from './cost-basis.calculator';
import { CalculationErrors } from './errors/calculation-errors';
import {
  FifoCostBasisCalculator,
  LifoCostBasisCalculator
} from './lot-cost-basis.calculator';
import { CALCULATION_DIVISION_MAX_FRACTION_DIGITS } from './portfolio-calculation.constants';
import {
  CostBasisOpeningState,
  PortfolioCalculationInput,
  PortfolioCalculationOptions
} from './types/calculation-input.types';
import { PortfolioCalculationResult } from './types/calculation-result.types';
import { CostBasisStrategy } from './types/cost-basis.strategy.enum';
import { CalculationTransaction } from './types/calculation-transaction.types';

const COST_BASIS_STRATEGY_CALCULATORS: Record<
  CostBasisStrategy,
  CostBasisCalculator
> = {
  [CostBasisStrategy.AVERAGE]: new AverageCostCalculator(),
  [CostBasisStrategy.FIFO]: new FifoCostBasisCalculator(),
  [CostBasisStrategy.LIFO]: new LifoCostBasisCalculator()
};

function isCostBasisStrategy(value: unknown): value is CostBasisStrategy {
  return (
    value === CostBasisStrategy.AVERAGE ||
    value === CostBasisStrategy.FIFO ||
    value === CostBasisStrategy.LIFO
  );
}

/**
 * Pure, deterministic, framework-independent portfolio calculation engine.
 *
 * The engine validates and normalizes its input, orders the ledger
 * chronologically, delegates the cost-basis accumulation and realized P&L to a
 * strategy, and derives `averageCost` from the exact `totalCost`/`quantity`
 * pair.
 *
 * The strategy can be selected by the `CostBasisStrategy` enum or injected as
 * a concrete `CostBasisCalculator`, defaulting to average cost.
 *
 * By default the engine validates every `occurredAt` and orders the ledger
 * chronologically. Callers that can already guarantee a chronological
 * `occurredAt ASC, id ASC` stream of normalized ISO timestamps may opt out of
 * that redundant work through `PortfolioCalculationOptions`; every other
 * caller keeps the unchanged validate-and-sort behavior.
 *
 * It performs no I/O, no logging, no database or HTTP calls, and holds no
 * state between calls, so it can be reused unchanged from the REST API,
 * background jobs, a CLI, or scheduled analytics.
 *
 * The input arrays and transaction objects are never mutated.
 */
export class PortfolioCalculationEngine {
  private readonly costBasis: CostBasisCalculator;

  constructor(
    costBasis:
      CostBasisCalculator | CostBasisStrategy = CostBasisStrategy.AVERAGE
  ) {
    this.costBasis = isCostBasisStrategy(costBasis)
      ? COST_BASIS_STRATEGY_CALCULATORS[costBasis]
      : costBasis;
  }

  calculate(
    input: PortfolioCalculationInput,
    options: PortfolioCalculationOptions = {}
  ): PortfolioCalculationResult {
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
        !options.trustedIsoDates &&
        (typeof transaction.occurredAt !== 'string' ||
          Number.isNaN(Date.parse(transaction.occurredAt)))
      ) {
        throw CalculationErrors.invalidDate();
      }
    }

    const transactions = options.alreadyOrdered
      ? input.transactions
      : this.orderChronologically(input.transactions);

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
   * Orders the ledger chronologically. Timestamps are parsed exactly once per
   * transaction before the sort so the comparator never re-parses dates.
   * Equal `occurredAt` values are resolved by `id` (ascending), and exact ties
   * fall back to the input order, which `Array.prototype.sort` keeps stable.
   * The source array is copied first.
   */
  private orderChronologically(
    transactions: CalculationTransaction[]
  ): CalculationTransaction[] {
    const keyed = transactions.map((transaction) => ({
      transaction,
      time: Date.parse(transaction.occurredAt),
      id: transaction.id ?? ''
    }));

    keyed.sort((a, b) => {
      if (a.time !== b.time) {
        return a.time < b.time ? -1 : 1;
      }
      if (a.id !== b.id) {
        return a.id < b.id ? -1 : 1;
      }
      return 0;
    });

    return keyed.map((entry) => entry.transaction);
  }
}
