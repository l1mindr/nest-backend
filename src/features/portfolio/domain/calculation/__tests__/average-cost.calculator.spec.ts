import * as decimalUtil from '@core/decimal/decimal.util';
import { AverageCostCalculator } from '../average-cost.calculator';
import { CalculationError } from '../errors/calculation-errors';
import { CalculationErrorCode } from '../errors/calculation-error-code.enum';
import { CostBasisOpeningState } from '../types/calculation-input.types';
import { CalculationTransaction } from '../types/calculation-transaction.types';
import { CalculationTransactionType } from '../types/calculation-transaction.types';

const opening = (): CostBasisOpeningState => ({
  quantity: '0',
  totalCost: '0'
});

const buy = (
  amount: string,
  price: string,
  fee?: string
): CalculationTransaction => ({
  type: CalculationTransactionType.BUY,
  amount,
  price,
  fee,
  occurredAt: '2026-07-28T08:00:00.000Z'
});

const sell = (amount: string, price: string): CalculationTransaction => ({
  type: CalculationTransactionType.SELL,
  amount,
  price,
  occurredAt: '2026-07-28T09:00:00.000Z'
});

const transferIn = (
  amount: string,
  price?: string
): CalculationTransaction => ({
  type: CalculationTransactionType.TRANSFER_IN,
  amount,
  price,
  occurredAt: '2026-07-28T10:00:00.000Z'
});

const transferOut = (amount: string): CalculationTransaction => ({
  type: CalculationTransactionType.TRANSFER_OUT,
  amount,
  occurredAt: '2026-07-28T11:00:00.000Z'
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

describe('AverageCostCalculator', () => {
  const calculator = new AverageCostCalculator();

  describe('BUY', () => {
    it('should accumulate quantity and cost for a single BUY', () => {
      expect(calculator.calculate([buy('1', '50000')], opening())).toEqual({
        quantity: '1',
        totalCost: '50000',
        realizedPnl: []
      });
    });

    it('should accumulate multiple BUYs exactly', () => {
      expect(
        calculator.calculate([buy('1', '50000'), buy('1', '70000')], opening())
      ).toEqual({
        quantity: '2',
        totalCost: '120000',
        realizedPnl: []
      });
    });

    it('should multiply 0.1 x 0.2 exactly', () => {
      expect(calculator.calculate([buy('0.1', '0.2')], opening())).toEqual({
        quantity: '0.1',
        totalCost: '0.02',
        realizedPnl: []
      });
    });

    it('should preserve fractional-asset precision', () => {
      expect(
        calculator.calculate([buy('0.00000001', '50000')], opening())
      ).toEqual({
        quantity: '0.00000001',
        totalCost: '0.0005',
        realizedPnl: []
      });
    });

    it('should preserve the fee separately without adding it to cost', () => {
      expect(
        calculator.calculate([buy('1', '50000', '10')], opening())
      ).toEqual({
        quantity: '1',
        totalCost: '50000',
        realizedPnl: []
      });
    });

    it('should allow a zero fee', () => {
      expect(calculator.calculate([buy('1', '50000', '0')], opening())).toEqual(
        {
          quantity: '1',
          totalCost: '50000',
          realizedPnl: []
        }
      );
    });
  });

  describe('SELL', () => {
    it('should release the proportional cost basis and record realized P&L', () => {
      const state = { quantity: '2', totalCost: '120000' };
      expect(calculator.calculate([sell('1', '70000')], state)).toEqual({
        quantity: '1',
        totalCost: '60000',
        realizedPnl: [
          expect.objectContaining({
            amount: '1',
            proceeds: '70000',
            releasedCostBasis: '60000',
            realizedPnl: '10000'
          })
        ]
      });
    });

    it('should realize a loss when the sale price is below the average cost', () => {
      const state = { quantity: '2', totalCost: '120000' };
      const result = calculator.calculate([sell('1', '50000')], state);
      expect(result.realizedPnl).toEqual([
        expect.objectContaining({
          proceeds: '50000',
          releasedCostBasis: '60000',
          realizedPnl: '-10000'
        })
      ]);
    });

    it('should realize no gain when selling at the average cost', () => {
      const state = { quantity: '2', totalCost: '120000' };
      const result = calculator.calculate([sell('1', '60000')], state);
      expect(result.realizedPnl).toEqual([
        expect.objectContaining({
          proceeds: '60000',
          releasedCostBasis: '60000',
          realizedPnl: '0'
        })
      ]);
    });

    it('should release basis across multiple sells', () => {
      const result = calculator.calculate(
        [sell('1', '70000'), sell('0.5', '50000')],
        { quantity: '2', totalCost: '120000' }
      );
      expect(result.quantity).toBe('0.5');
      expect(result.totalCost).toBe('30000');
      expect(result.realizedPnl).toHaveLength(2);
    });

    it('should keep the average cost of the remainder unchanged after a sale', () => {
      const result = calculator.calculate(
        [buy('1', '50000'), buy('1', '70000'), sell('1', '90000')],
        opening()
      );
      expect(result.quantity).toBe('1');
      expect(result.totalCost).toBe('60000');
    });

    it('should realize the full proceeds as gain when selling zero-cost transfer units', () => {
      const result = calculator.calculate(
        [transferIn('1'), sell('1', '60000')],
        opening()
      );
      expect(result).toEqual({
        quantity: '0',
        totalCost: '0',
        realizedPnl: [
          expect.objectContaining({
            amount: '1',
            price: '60000',
            proceeds: '60000',
            releasedCostBasis: '0',
            realizedPnl: '60000'
          })
        ]
      });
    });

    it('should release the entire basis on a full sell-out', () => {
      const state = { quantity: '2', totalCost: '120000' };
      expect(calculator.calculate([sell('2', '70000')], state)).toEqual({
        quantity: '0',
        totalCost: '0',
        realizedPnl: [
          expect.objectContaining({
            amount: '2',
            price: '70000',
            proceeds: '140000',
            releasedCostBasis: '120000',
            realizedPnl: '20000'
          })
        ]
      });
    });

    it('should clamp a SELL exceeding the available quantity to the held amount', () => {
      const state = { quantity: '1', totalCost: '50000' };
      expect(calculator.calculate([sell('2', '70000')], state)).toEqual({
        quantity: '0',
        totalCost: '0',
        realizedPnl: [
          expect.objectContaining({
            amount: '1',
            price: '70000',
            proceeds: '70000',
            releasedCostBasis: '50000',
            realizedPnl: '20000'
          })
        ]
      });
    });

    it('should require a price for SELL', () => {
      expectCalculationError(
        () =>
          calculator.calculate(
            [
              {
                type: CalculationTransactionType.SELL,
                amount: '1',
                occurredAt: '2026-07-28T09:00:00.000Z'
              }
            ],
            opening()
          ),
        CalculationErrorCode.MISSING_PRICE
      );
    });

    it('should truncate a non-terminating average cost at the domain precision', () => {
      const result = calculator.calculate(
        [buy('1', '1'), buy('2', '0.5'), sell('1', '1')],
        opening()
      );
      expect(result.realizedPnl).toEqual([
        expect.objectContaining({
          releasedCostBasis: '0.66666666666666666666666666',
          realizedPnl: '0.33333333333333333333333334'
        })
      ]);
      expect(result.quantity).toBe('2');
      expect(result.totalCost).toBe('1.33333333333333333333333334');
    });
  });

  describe('TRANSFER_IN', () => {
    it('should increase quantity without creating acquisition cost', () => {
      expect(calculator.calculate([transferIn('1.5')], opening())).toEqual({
        quantity: '1.5',
        totalCost: '0',
        realizedPnl: []
      });
    });

    it('should ignore a transfer price for cost basis', () => {
      expect(
        calculator.calculate([transferIn('1.5', '99999')], opening())
      ).toEqual({
        quantity: '1.5',
        totalCost: '0',
        realizedPnl: []
      });
    });
  });

  describe('TRANSFER_OUT', () => {
    it('should release cost basis without creating a sale', () => {
      const state = { quantity: '2', totalCost: '120000' };
      expect(calculator.calculate([transferOut('1')], state)).toEqual({
        quantity: '1',
        totalCost: '60000',
        realizedPnl: []
      });
    });

    it('should clamp a TRANSFER_OUT exceeding the available quantity to the held amount', () => {
      const state = { quantity: '1', totalCost: '50000' };
      expect(calculator.calculate([transferOut('1.5')], state)).toEqual({
        quantity: '0',
        totalCost: '0',
        realizedPnl: []
      });
    });
  });

  describe('validation', () => {
    it('should reject an unsupported transaction type', () => {
      expectCalculationError(
        () =>
          calculator.calculate(
            [
              {
                type: 'DEPOSIT',
                amount: '1',
                occurredAt: '2026-07-28T08:00:00.000Z'
              } as unknown as CalculationTransaction
            ],
            opening()
          ),
        CalculationErrorCode.UNSUPPORTED_TRANSACTION_TYPE
      );
    });

    it('should reject a malformed amount', () => {
      expectCalculationError(
        () =>
          calculator.calculate(
            [
              {
                type: CalculationTransactionType.BUY,
                amount: 'abc',
                price: '1',
                occurredAt: '2026-07-28T08:00:00.000Z'
              } as CalculationTransaction
            ],
            opening()
          ),
        CalculationErrorCode.INVALID_DECIMAL
      );
    });

    it('should reject a zero amount', () => {
      expectCalculationError(
        () => calculator.calculate([buy('0', '1')], opening()),
        CalculationErrorCode.NEGATIVE_AMOUNT
      );
    });

    it('should reject a negative amount', () => {
      expectCalculationError(
        () => calculator.calculate([buy('-1', '1')], opening()),
        CalculationErrorCode.NEGATIVE_AMOUNT
      );
    });

    it('should reject a negative price', () => {
      expectCalculationError(
        () => calculator.calculate([buy('1', '-1')], opening()),
        CalculationErrorCode.NEGATIVE_PRICE
      );
    });

    it('should reject a malformed price', () => {
      expectCalculationError(
        () => calculator.calculate([buy('1', '1.2.3')], opening()),
        CalculationErrorCode.INVALID_DECIMAL
      );
    });

    it('should require a price for BUY', () => {
      expectCalculationError(
        () =>
          calculator.calculate(
            [
              {
                type: CalculationTransactionType.BUY,
                amount: '1',
                occurredAt: '2026-07-28T08:00:00.000Z'
              }
            ],
            opening()
          ),
        CalculationErrorCode.MISSING_PRICE
      );
    });

    it('should reject a negative fee', () => {
      expectCalculationError(
        () => calculator.calculate([buy('1', '1', '-0.5')], opening()),
        CalculationErrorCode.NEGATIVE_FEE
      );
    });

    it('should reject a malformed fee', () => {
      expectCalculationError(
        () => calculator.calculate([buy('1', '1', 'abc')], opening()),
        CalculationErrorCode.INVALID_DECIMAL
      );
    });

    it('should reject a negative opening quantity', () => {
      expectCalculationError(
        () =>
          calculator.calculate([], {
            quantity: '-1',
            totalCost: '0'
          }),
        CalculationErrorCode.NEGATIVE_QUANTITY
      );
    });

    it('should reject a malformed opening cost', () => {
      expectCalculationError(
        () =>
          calculator.calculate([], {
            quantity: '0',
            totalCost: 'abc'
          }),
        CalculationErrorCode.INVALID_DECIMAL
      );
    });

    it('should reject a null transaction entry', () => {
      expectCalculationError(
        () =>
          calculator.calculate(
            [null as unknown as CalculationTransaction],
            opening()
          ),
        CalculationErrorCode.INVALID_INPUT
      );
    });
  });

  describe('state handling', () => {
    it('should return the opening state for an empty transaction list', () => {
      const state = { quantity: '1.5', totalCost: '90000' };
      expect(calculator.calculate([], state)).toEqual({
        ...state,
        realizedPnl: []
      });
    });

    it('should add to the opening state', () => {
      const state = { quantity: '1.5', totalCost: '90000' };
      expect(calculator.calculate([buy('0.5', '60000')], state)).toEqual({
        quantity: '2',
        totalCost: '120000',
        realizedPnl: []
      });
    });

    it('should not mutate the input transactions', () => {
      const transactions = [buy('1', '50000'), transferOut('0.25')];
      const snapshot = JSON.parse(JSON.stringify(transactions));
      calculator.calculate(transactions, opening());
      expect(transactions).toEqual(snapshot);
    });
  });

  describe('disposal cost-basis release', () => {
    it('should release consecutive SELLs from the recomputed average, never a stale value', () => {
      const result = calculator.calculate(
        [sell('6.5', '10'), sell('0.4', '10')],
        { quantity: '7', totalCost: '1' }
      );

      expect(result.quantity).toBe('0.1');
      expect(result.totalCost).toBe('0.014285714285714285714285718');
      expect(result.realizedPnl).toEqual([
        expect.objectContaining({
          proceeds: '65',
          releasedCostBasis: '0.92857142857142857142857141',
          realizedPnl: '64.07142857142857142857142859'
        }),
        expect.objectContaining({
          proceeds: '4',
          releasedCostBasis: '0.057142857142857142857142872',
          realizedPnl: '3.942857142857142857142857128'
        })
      ]);
    });

    it('should recompute the average after a BUY', () => {
      const result = calculator.calculate(
        [buy('2', '1'), sell('1', '2')],
        opening()
      );

      expect(result).toEqual({
        quantity: '1',
        totalCost: '1',
        realizedPnl: [
          expect.objectContaining({
            releasedCostBasis: '1',
            realizedPnl: '1'
          })
        ]
      });
    });

    it('should recompute the average after a TRANSFER_IN on a zero-cost position', () => {
      const result = calculator.calculate(
        [transferIn('2'), sell('1', '5')],
        opening()
      );

      expect(result).toEqual({
        quantity: '1',
        totalCost: '0',
        realizedPnl: [
          expect.objectContaining({
            releasedCostBasis: '0',
            realizedPnl: '5'
          })
        ]
      });
    });

    it('should release zero basis for a TRANSFER_OUT on a zero-cost position', () => {
      const result = calculator.calculate(
        [transferIn('3'), transferOut('2')],
        opening()
      );

      expect(result).toEqual({
        quantity: '1',
        totalCost: '0',
        realizedPnl: []
      });
    });

    it('should skip the redundant zero-cost division', () => {
      const divideSpy = jest.spyOn(decimalUtil, 'divideDecimals');
      try {
        const result = calculator.calculate(
          [transferIn('3'), sell('1', '5'), transferOut('1')],
          opening()
        );

        expect(divideSpy).not.toHaveBeenCalled();
        expect(result).toEqual({
          quantity: '1',
          totalCost: '0',
          realizedPnl: [
            expect.objectContaining({
              releasedCostBasis: '0',
              realizedPnl: '5'
            })
          ]
        });
      } finally {
        divideSpy.mockRestore();
      }
    });

    it('should keep exact decimal precision for a large disposal history', () => {
      const result = calculator.calculate(
        [
          buy('999999999999999999.99', '99999999.99'),
          sell('500000000000000000', '100000000')
        ],
        opening()
      );

      expect(result.quantity).toBe('499999999999999999.99');
      expect(result.totalCost).toBe('49999999994999999999000000.0001');
      expect(result.realizedPnl).toEqual([
        expect.objectContaining({
          proceeds: '50000000000000000000000000',
          releasedCostBasis: '49999999995000000000000000',
          realizedPnl: '5000000000000000'
        })
      ]);
    });
  });
});
