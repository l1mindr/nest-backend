import { CostBasisOpeningState } from './types/calculation-input.types';
import { CostBasisResult } from './types/calculation-result.types';
import { CalculationTransaction } from './types/calculation-transaction.types';

/**
 * Abstraction over cost-basis strategies. The engine depends on this interface
 * and each strategy implements its own disposal semantics; adding a strategy
 * does not touch the transaction vocabulary, the engine, or the repository
 * layer.
 */
export interface CostBasisCalculator {
  /**
   * Processes a chronologically ordered transaction list against an opening
   * state and returns the exact resulting quantity, accumulated acquisition
   * cost and realized P&L events. The transactions are never mutated.
   */
  calculate(
    transactions: CalculationTransaction[],
    opening: CostBasisOpeningState
  ): CostBasisResult;
}
