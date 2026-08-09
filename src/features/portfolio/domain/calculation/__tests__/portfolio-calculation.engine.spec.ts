import { CostBasisCalculator } from '../cost-basis.calculator';
import { CalculationError } from '../errors/calculation-errors';
import { CalculationErrorCode } from '../errors/calculation-error-code.enum';
import { PortfolioCalculationEngine } from '../portfolio-calculation.engine';
import { PortfolioCalculationInput } from '../types/calculation-input.types';
import { CalculationTransaction } from '../types/calculation-transaction.types';
import { CalculationTransactionType } from '../types/calculation-transaction.types';
import { AverageCostCalculator } from '../average-cost.calculator';

const at = (time: string, id?: string) => ({ occurredAt: time, id });

const buy = (
  amount: string,
  price: string,
  time: string,
  id?: string
): CalculationTransaction => ({
  ...at(time, id),
  type: CalculationTransactionType.BUY,
  amount,
  price
});

const sell = (
  amount: string,
  price: string,
  time: string,
  id?: string
): CalculationTransaction => ({
  ...at(time, id),
  type: CalculationTransactionType.SELL,
  amount,
  price
});

const transferIn = (
  amount: string,
  time: string,
  id?: string
): CalculationTransaction => ({
  ...at(time, id),
  type: CalculationTransactionType.TRANSFER_IN,
  amount
});

function expectCalculationError(
  fn: () => unknown,
  code: CalculationErrorCode
): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(CalculationError);
  expect((caught as CalculationError).code).toBe(code);
}

describe('PortfolioCalculationEngine', () => {
  const engine = new PortfolioCalculationEngine();

  describe('calculation', () => {
    it('should compute quantity, cost and average cost for two BUYs', () => {
      expect(
        engine.calculate({
          assetId: 'asset-id',
          transactions: [
            buy('1', '50000', '2026-07-28T08:00:00.000Z'),
            buy('1', '70000', '2026-07-28T09:00:00.000Z')
          ]
        })
      ).toEqual({
        quantity: '2',
        totalCost: '120000',
        averageCost: '60000',
        realizedPnl: []
      });
    });

    it('should compute exact decimals (0.1 x 0.2 = 0.02)', () => {
      expect(
        engine.calculate({
          transactions: [buy('0.1', '0.2', '2026-07-28T08:00:00.000Z')]
        })
      ).toEqual({
        quantity: '0.1',
        totalCost: '0.02',
        averageCost: '0.2',
        realizedPnl: []
      });
    });

    it('should add 0.1 + 0.2 exactly', () => {
      expect(
        engine.calculate({
          transactions: [
            buy('0.1', '1', '2026-07-28T08:00:00.000Z'),
            buy('0.2', '1', '2026-07-28T09:00:00.000Z')
          ]
        })
      ).toEqual({
        quantity: '0.3',
        totalCost: '0.3',
        averageCost: '1',
        realizedPnl: []
      });
    });

    it('should carry an opening state through the transactions', () => {
      expect(
        engine.calculate({
          openingQuantity: '1.5',
          openingCost: '90000',
          transactions: [buy('0.5', '60000', '2026-07-28T08:00:00.000Z')]
        })
      ).toEqual({
        quantity: '2',
        totalCost: '120000',
        averageCost: '60000',
        realizedPnl: []
      });
    });

    it('should report a zero average cost when nothing is held', () => {
      expect(engine.calculate({ transactions: [] })).toEqual({
        quantity: '0',
        totalCost: '0',
        averageCost: '0',
        realizedPnl: []
      });
    });

    it('should define a full sell-out deterministically', () => {
      expect(
        engine.calculate({
          transactions: [
            buy('2', '60000', '2026-07-28T08:00:00.000Z'),
            sell('2', '70000', '2026-07-28T09:00:00.000Z')
          ]
        })
      ).toEqual({
        quantity: '0',
        totalCost: '120000',
        averageCost: '0',
        realizedPnl: []
      });
    });

    it('should keep transfers out of the cost basis', () => {
      expect(
        engine.calculate({
          transactions: [
            transferIn('1.5', '2026-07-28T08:00:00.000Z'),
            transferIn('0.5', '2026-07-28T09:00:00.000Z')
          ]
        })
      ).toEqual({
        quantity: '2',
        totalCost: '0',
        averageCost: '0',
        realizedPnl: []
      });
    });
  });

  describe('ordering', () => {
    it('should process out-of-order transactions chronologically', () => {
      expect(
        engine.calculate({
          transactions: [
            buy('1', '70000', '2026-07-28T09:00:00.000Z'),
            buy('1', '50000', '2026-07-28T08:00:00.000Z')
          ]
        })
      ).toEqual({
        quantity: '2',
        totalCost: '120000',
        averageCost: '60000',
        realizedPnl: []
      });
    });

    it('should use the id as a tie-breaker for equal timestamps', () => {
      expect(
        engine.calculate({
          transactions: [
            sell('1', '70000', '2026-07-28T08:00:00.000Z', 'b'),
            buy('1', '50000', '2026-07-28T08:00:00.000Z', 'a')
          ]
        })
      ).toEqual({
        quantity: '0',
        totalCost: '50000',
        averageCost: '0',
        realizedPnl: []
      });
    });

    it('should fall back to the stable input order when ids are absent', () => {
      expect(
        engine.calculate({
          transactions: [
            buy('1', '50000', '2026-07-28T08:00:00.000Z'),
            sell('1', '70000', '2026-07-28T08:00:00.000Z')
          ]
        })
      ).toEqual({
        quantity: '0',
        totalCost: '50000',
        averageCost: '0',
        realizedPnl: []
      });
    });
  });

  describe('validation', () => {
    it('should reject a non-object input', () => {
      expectCalculationError(
        () => engine.calculate(null as unknown as PortfolioCalculationInput),
        CalculationErrorCode.INVALID_INPUT
      );
    });

    it('should reject a missing transactions array', () => {
      expectCalculationError(
        () =>
          engine.calculate({
            transactions: undefined
          } as unknown as PortfolioCalculationInput),
        CalculationErrorCode.INVALID_INPUT
      );
    });

    it('should reject an invalid occurredAt', () => {
      expectCalculationError(
        () =>
          engine.calculate({
            transactions: [
              {
                type: CalculationTransactionType.BUY,
                amount: '1',
                price: '1',
                occurredAt: 'not-a-date'
              }
            ]
          }),
        CalculationErrorCode.INVALID_DATE
      );
    });

    it('should reject a negative opening quantity', () => {
      expectCalculationError(
        () =>
          engine.calculate({
            openingQuantity: '-1',
            transactions: []
          }),
        CalculationErrorCode.NEGATIVE_QUANTITY
      );
    });

    it('should reject a malformed opening cost', () => {
      expectCalculationError(
        () =>
          engine.calculate({
            openingCost: 'abc',
            transactions: []
          }),
        CalculationErrorCode.INVALID_DECIMAL
      );
    });

    it('should propagate unsupported transaction types', () => {
      expectCalculationError(
        () =>
          engine.calculate({
            transactions: [
              {
                type: 'WITHDRAWAL',
                amount: '1',
                occurredAt: '2026-07-28T08:00:00.000Z'
              } as unknown as CalculationTransaction
            ]
          }),
        CalculationErrorCode.UNSUPPORTED_TRANSACTION_TYPE
      );
    });

    it('should propagate insufficient quantity', () => {
      expectCalculationError(
        () =>
          engine.calculate({
            transactions: [sell('2', '70000', '2026-07-28T08:00:00.000Z')]
          }),
        CalculationErrorCode.INSUFFICIENT_QUANTITY
      );
    });
  });

  describe('purity', () => {
    it('should not mutate the input array or transactions', () => {
      const input: PortfolioCalculationInput = {
        assetId: 'asset-id',
        openingQuantity: '0.5',
        openingCost: '25000',
        transactions: [
          buy('1', '50000', '2026-07-28T09:00:00.000Z', 'b'),
          buy('0.5', '70000', '2026-07-28T08:00:00.000Z', 'a')
        ]
      };
      const snapshot = JSON.parse(JSON.stringify(input));

      engine.calculate(input);

      expect(input).toEqual(snapshot);
    });

    it('should compute the same result for the same ledger regardless of input order', () => {
      const first = [
        buy('1', '50000', '2026-07-28T08:00:00.000Z', 'a'),
        sell('0.25', '70000', '2026-07-28T09:00:00.000Z', 'b'),
        buy('1', '70000', '2026-07-28T10:00:00.000Z', 'c')
      ];
      const shuffled = [first[2], first[0], first[1]];

      const resultA = engine.calculate({ transactions: first });
      const resultB = engine.calculate({ transactions: shuffled });
      expect(resultB).toEqual(resultA);
    });
  });

  describe('cost-basis delegation', () => {
    it('should hand the ordered transactions and opening state to the strategy', () => {
      const costBasis: CostBasisCalculator = {
        calculate: jest.fn(() => ({
          quantity: '2',
          totalCost: '120000',
          realizedPnl: []
        }))
      };
      const engineWithStub = new PortfolioCalculationEngine(costBasis);

      const result = engineWithStub.calculate({
        openingQuantity: '1',
        openingCost: '50000',
        transactions: [
          buy('1', '70000', '2026-07-28T09:00:00.000Z', 'b'),
          buy('1', '50000', '2026-07-28T08:00:00.000Z', 'a')
        ]
      });

      expect(costBasis.calculate).toHaveBeenCalledTimes(1);
      expect(costBasis.calculate).toHaveBeenCalledWith(
        [
          buy('1', '50000', '2026-07-28T08:00:00.000Z', 'a'),
          buy('1', '70000', '2026-07-28T09:00:00.000Z', 'b')
        ],
        { quantity: '1', totalCost: '50000' }
      );
      expect(result).toEqual({
        quantity: '2',
        totalCost: '120000',
        averageCost: '60000',
        realizedPnl: []
      });
    });

    it('should default to the average-cost strategy', () => {
      const engineWithDefault = new PortfolioCalculationEngine();
      expect(
        engineWithDefault.calculate({
          transactions: [buy('1', '50000', '2026-07-28T08:00:00.000Z')]
        })
      ).toEqual({
        quantity: '1',
        totalCost: '50000',
        averageCost: '50000',
        realizedPnl: []
      });
    });
  });

  it('should be usable with the concrete strategy without decoration', () => {
    const engine = new PortfolioCalculationEngine(new AverageCostCalculator());
    expect(
      engine.calculate({
        transactions: [transferIn('2', '2026-07-28T08:00:00.000Z')]
      })
    ).toEqual({
      quantity: '2',
      totalCost: '0',
      averageCost: '0',
      realizedPnl: []
    });
  });
});
