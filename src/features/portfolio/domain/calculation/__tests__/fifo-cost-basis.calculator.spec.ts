import { CalculationError } from '../errors/calculation-errors';
import { CalculationErrorCode } from '../errors/calculation-error-code.enum';
import { FifoCostBasisCalculator } from '../lot-cost-basis.calculator';
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
  occurredAt = '2026-07-28T08:00:00.000Z',
  fee?: string
): CalculationTransaction => ({
  type: CalculationTransactionType.BUY,
  amount,
  price,
  fee,
  occurredAt
});

const sell = (amount: string, price: string): CalculationTransaction => ({
  type: CalculationTransactionType.SELL,
  amount,
  price,
  occurredAt: '2026-07-28T09:00:00.000Z'
});

const transferIn = (amount: string): CalculationTransaction => ({
  type: CalculationTransactionType.TRANSFER_IN,
  amount,
  occurredAt: '2026-07-28T08:00:00.000Z'
});

const transferOut = (amount: string): CalculationTransaction => ({
  type: CalculationTransactionType.TRANSFER_OUT,
  amount,
  occurredAt: '2026-07-28T09:00:00.000Z'
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

describe('FifoCostBasisCalculator', () => {
  const calculator = new FifoCostBasisCalculator();

  it('should release the oldest lot cost basis first', () => {
    expect(
      calculator.calculate(
        [buy('1', '100'), buy('1', '200'), sell('1', '150')],
        opening()
      )
    ).toEqual({
      quantity: '1',
      totalCost: '200',
      realizedPnl: [
        expect.objectContaining({
          amount: '1',
          proceeds: '150',
          releasedCostBasis: '100',
          realizedPnl: '50'
        })
      ]
    });
  });

  it('should consume a partial sale across lots in acquisition order', () => {
    expect(
      calculator.calculate(
        [buy('1', '100'), buy('1', '200'), sell('1.5', '180')],
        opening()
      )
    ).toEqual({
      quantity: '0.5',
      totalCost: '100',
      realizedPnl: [
        expect.objectContaining({
          amount: '1.5',
          proceeds: '270',
          releasedCostBasis: '200',
          realizedPnl: '70'
        })
      ]
    });
  });

  it('should consume one lot across multiple SELLs', () => {
    const result = calculator.calculate(
      [buy('1.5', '100'), sell('0.5', '120'), sell('0.5', '130')],
      opening()
    );
    expect(result.quantity).toBe('0.5');
    expect(result.totalCost).toBe('50');
    expect(result.realizedPnl).toEqual([
      expect.objectContaining({
        proceeds: '60',
        releasedCostBasis: '50',
        realizedPnl: '10'
      }),
      expect.objectContaining({
        proceeds: '65',
        releasedCostBasis: '50',
        realizedPnl: '15'
      })
    ]);
  });

  it('should treat the opening position as the oldest lot', () => {
    const result = calculator.calculate([sell('1', '120')], {
      quantity: '1',
      totalCost: '100'
    });
    expect(result.realizedPnl).toEqual([
      expect.objectContaining({ releasedCostBasis: '100', realizedPnl: '20' })
    ]);
  });

  it('should consume zero-cost transfer lots before later buys', () => {
    expect(
      calculator.calculate(
        [
          transferIn('1'),
          buy('1', '100', '2026-07-28T09:00:00.000Z'),
          sell('1', '150')
        ],
        opening()
      )
    ).toEqual({
      quantity: '1',
      totalCost: '100',
      realizedPnl: [
        expect.objectContaining({ releasedCostBasis: '0', realizedPnl: '150' })
      ]
    });
  });

  it('should release cost basis on transfer-out without realized P&L', () => {
    expect(
      calculator.calculate(
        [buy('1', '100'), buy('1', '200'), transferOut('1')],
        opening()
      )
    ).toEqual({ quantity: '1', totalCost: '200', realizedPnl: [] });
  });

  it('should consume a transfer-in lot on transfer-out without realized P&L', () => {
    expect(
      calculator.calculate([transferIn('1'), transferOut('0.5')], opening())
    ).toEqual({ quantity: '0.5', totalCost: '0', realizedPnl: [] });
  });

  it('should realize the complete gain on a full sell-out', () => {
    expect(
      calculator.calculate([buy('2', '60000'), sell('2', '70000')], opening())
    ).toEqual({
      quantity: '0',
      totalCost: '0',
      realizedPnl: [
        expect.objectContaining({
          amount: '2',
          proceeds: '140000',
          releasedCostBasis: '120000',
          realizedPnl: '20000'
        })
      ]
    });
  });

  it('should reject a sale exceeding the held quantity', () => {
    expectCalculationError(
      () =>
        calculator.calculate([sell('2', '150')], {
          quantity: '1',
          totalCost: '100'
        }),
      CalculationErrorCode.INSUFFICIENT_QUANTITY
    );
  });

  it('should accumulate quantity and cost across BUYs', () => {
    expect(
      calculator.calculate([buy('1', '50000'), buy('1', '70000')], opening())
    ).toEqual({
      quantity: '2',
      totalCost: '120000',
      realizedPnl: []
    });
  });

  it('should preserve the fee separately without adding it to cost', () => {
    expect(
      calculator.calculate(
        [buy('1', '50000', '2026-07-28T08:00:00.000Z', '10')],
        opening()
      )
    ).toEqual({
      quantity: '1',
      totalCost: '50000',
      realizedPnl: []
    });
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

  it('should not mutate the input transactions', () => {
    const transactions = [buy('1', '100'), buy('1', '200'), sell('1', '150')];
    const snapshot = JSON.parse(JSON.stringify(transactions));
    calculator.calculate(transactions, opening());
    expect(transactions).toEqual(snapshot);
  });

  it('should process a large alternating ledger without quadratic behavior', () => {
    const transactions: CalculationTransaction[] = [];
    for (let i = 0; i < 25000; i++) {
      transactions.push(buy('1', '100'));
    }
    for (let i = 0; i < 25000; i++) {
      transactions.push(sell('1', '150'));
    }
    const result = calculator.calculate(transactions, opening());
    expect(result.quantity).toBe('0');
    expect(result.totalCost).toBe('0');
    expect(result.realizedPnl).toHaveLength(25000);
    expect(result.realizedPnl[0]).toEqual(
      expect.objectContaining({ releasedCostBasis: '100', realizedPnl: '50' })
    );
    expect(result.realizedPnl[24999]).toEqual(
      expect.objectContaining({ releasedCostBasis: '100', realizedPnl: '50' })
    );
  });
});
