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
    it('should reduce the quantity without touching cost', () => {
      const state = { quantity: '2', totalCost: '120000' };
      expect(calculator.calculate([sell('1', '70000')], state)).toEqual({
        quantity: '1',
        totalCost: '120000',
        realizedPnl: []
      });
    });

    it('should reject a SELL exceeding the available quantity', () => {
      const state = { quantity: '1', totalCost: '50000' };
      expectCalculationError(
        () => calculator.calculate([sell('2', '70000')], state),
        CalculationErrorCode.INSUFFICIENT_QUANTITY
      );
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
    it('should decrease quantity without creating a sale', () => {
      const state = { quantity: '2', totalCost: '120000' };
      expect(calculator.calculate([transferOut('1')], state)).toEqual({
        quantity: '1',
        totalCost: '120000',
        realizedPnl: []
      });
    });

    it('should reject a TRANSFER_OUT exceeding the available quantity', () => {
      const state = { quantity: '1', totalCost: '50000' };
      expectCalculationError(
        () => calculator.calculate([transferOut('1.5')], state),
        CalculationErrorCode.INSUFFICIENT_QUANTITY
      );
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
});
