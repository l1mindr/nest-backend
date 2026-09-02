import { HoldingsCalculator } from '../holdings.calculator';
import { CalculationTransactionType } from '../types/calculation-transaction.types';

describe('HoldingsCalculator', () => {
  let calculator: HoldingsCalculator;

  beforeEach(() => {
    calculator = new HoldingsCalculator();
  });

  describe('calculateQuantity', () => {
    it('should return opening quantity when no transactions', () => {
      const result = calculator.calculateQuantity([], '20');
      expect(result).toBe('20');
    });

    it('should return 0 when no opening quantity and no transactions', () => {
      const result = calculator.calculateQuantity([]);
      expect(result).toBe('0');
    });

    it('should add BUY transaction to holdings', () => {
      const transactions = [
        {
          type: CalculationTransactionType.BUY,
          amount: '10',
          occurredAt: '2026-01-01T00:00:00Z'
        }
      ];
      const result = calculator.calculateQuantity(transactions);
      expect(result).toBe('10');
    });

    it('should add TRANSFER_IN transaction to holdings', () => {
      const transactions = [
        {
          type: CalculationTransactionType.TRANSFER_IN,
          amount: '20',
          occurredAt: '2026-01-01T00:00:00Z'
        }
      ];
      const result = calculator.calculateQuantity(transactions);
      expect(result).toBe('20');
    });

    it('should subtract SELL transaction from holdings', () => {
      const transactions = [
        {
          type: CalculationTransactionType.BUY,
          amount: '20',
          occurredAt: '2026-01-01T00:00:00Z'
        },
        {
          type: CalculationTransactionType.SELL,
          amount: '5',
          occurredAt: '2026-01-02T00:00:00Z'
        }
      ];
      const result = calculator.calculateQuantity(transactions);
      expect(result).toBe('15');
    });

    it('should subtract TRANSFER_OUT transaction from holdings', () => {
      const transactions = [
        {
          type: CalculationTransactionType.BUY,
          amount: '20',
          occurredAt: '2026-01-01T00:00:00Z'
        },
        {
          type: CalculationTransactionType.TRANSFER_OUT,
          amount: '3',
          occurredAt: '2026-01-02T00:00:00Z'
        }
      ];
      const result = calculator.calculateQuantity(transactions);
      expect(result).toBe('17');
    });

    it('should handle multiple transactions', () => {
      const transactions = [
        {
          type: CalculationTransactionType.BUY,
          amount: '20',
          occurredAt: '2026-01-01T00:00:00Z'
        },
        {
          type: CalculationTransactionType.BUY,
          amount: '10',
          occurredAt: '2026-01-02T00:00:00Z'
        },
        {
          type: CalculationTransactionType.SELL,
          amount: '5',
          occurredAt: '2026-01-03T00:00:00Z'
        },
        {
          type: CalculationTransactionType.TRANSFER_OUT,
          amount: '3',
          occurredAt: '2026-01-04T00:00:00Z'
        }
      ];
      const result = calculator.calculateQuantity(transactions);
      expect(result).toBe('22'); // 20 + 10 - 5 - 3 = 22
    });

    it('should include opening quantity in calculations', () => {
      const transactions = [
        {
          type: CalculationTransactionType.BUY,
          amount: '5',
          occurredAt: '2026-01-01T00:00:00Z'
        }
      ];
      const result = calculator.calculateQuantity(transactions, '20');
      expect(result).toBe('25'); // 20 + 5 = 25
    });

    it('should handle decimal amounts correctly', () => {
      const transactions = [
        {
          type: CalculationTransactionType.BUY,
          amount: '0.5',
          occurredAt: '2026-01-01T00:00:00Z'
        },
        {
          type: CalculationTransactionType.TRANSFER_IN,
          amount: '0.25',
          occurredAt: '2026-01-02T00:00:00Z'
        },
        {
          type: CalculationTransactionType.SELL,
          amount: '0.1',
          occurredAt: '2026-01-03T00:00:00Z'
        }
      ];
      const result = calculator.calculateQuantity(transactions);
      expect(result).toBe('0.65'); // 0.5 + 0.25 - 0.1 = 0.65
    });
  });

  describe('validateSell', () => {
    it('should return true when current equals sell amount', () => {
      const result = calculator.validateSell('10', '10');
      expect(result).toBe(true);
    });

    it('should return true when current is greater than sell amount', () => {
      const result = calculator.validateSell('20', '10');
      expect(result).toBe(true);
    });

    it('should return false when current is less than sell amount', () => {
      const result = calculator.validateSell('5', '10');
      expect(result).toBe(false);
    });

    it('should return false when trying to sell more than available', () => {
      const result = calculator.validateSell('15', '20');
      expect(result).toBe(false);
    });

    it('should handle decimal values correctly', () => {
      const result = calculator.validateSell('1.5', '1.5');
      expect(result).toBe(true);

      const result2 = calculator.validateSell('1.4', '1.5');
      expect(result2).toBe(false);
    });
  });
});
