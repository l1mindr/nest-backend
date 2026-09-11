import { TransactionPriceCurrency } from '../../enums/transaction-price-currency.enum';
import {
  normalizeTransactionPrice,
  tomanToUsd,
  usdToToman
} from '../transaction-price';

/** A realistic USDT/Toman rate, as the market endpoint reports it. */
const RATE = '234619';

describe('transaction price normalization', () => {
  describe('tomanToUsd', () => {
    it('converts a Toman price at the given rate', () => {
      // 234000 Toman per USDT, one USDT ≈ 234619 Toman → just under a dollar.
      expect(tomanToUsd('234000', RATE)).toBe('0.99736168');
    });

    it('converts a Toman fee the same way as a price', () => {
      expect(tomanToUsd('50000', RATE)).toBe('0.21311147');
    });

    it('is exact when the rate divides evenly', () => {
      expect(tomanToUsd('468000', '234000')).toBe('2');
      expect(tomanToUsd('234000', '234000')).toBe('1');
    });

    it('truncates rather than rounds, never inventing a digit', () => {
      // 1/3 is non-terminating; the 9th digit onward is dropped, not rounded.
      expect(tomanToUsd('1', '3')).toBe('0.33333333');
      expect(tomanToUsd('2', '3')).toBe('0.66666666');
    });

    it('holds a price far beyond float precision', () => {
      // 2^53 is where JS numbers start skipping integers.
      expect(tomanToUsd('90071992547409910', '10')).toBe('9007199254740991');
      expect(tomanToUsd('90071992547409930', '10')).toBe('9007199254740993');
    });

    // The whole reason this does not go through `Number`: 0.1 + 0.2 arithmetic
    // on a seven-digit Toman price sheds digits well above the 8th decimal.
    it('does not drift the way float division would', () => {
      const exact = tomanToUsd('234567', '234619');

      expect(exact).toBe('0.99977836');
      expect(exact).not.toContain('e');
      expect(exact.split('.')[1]).toHaveLength(8);
    });
  });

  describe('usdToToman', () => {
    it('restates a USD price in Toman at the given rate', () => {
      expect(usdToToman('1', RATE)).toBe('234619');
      expect(usdToToman('2.5', '234000')).toBe('585000');
    });

    it('round-trips a rate-aligned value exactly', () => {
      expect(tomanToUsd(usdToToman('2', RATE), RATE)).toBe('2');
    });
  });

  describe('normalizeTransactionPrice', () => {
    it('passes a USD entry through and records no conversion', () => {
      expect(
        normalizeTransactionPrice({
          price: '1',
          fee: '2',
          priceCurrency: TransactionPriceCurrency.USD,
          tomanPerUsdt: RATE
        })
      ).toEqual({
        price: '1',
        fee: '2',
        priceCurrency: TransactionPriceCurrency.USD,
        enteredPrice: null,
        enteredFee: null,
        usdtTomanRate: null
      });
    });

    it('converts a Toman entry and keeps the original alongside the rate', () => {
      expect(
        normalizeTransactionPrice({
          price: '234000',
          fee: '50000',
          priceCurrency: TransactionPriceCurrency.TOMAN,
          tomanPerUsdt: RATE
        })
      ).toEqual({
        price: '0.99736168',
        fee: '0.21311147',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        enteredPrice: '234000',
        enteredFee: '50000',
        usdtTomanRate: RATE
      });
    });

    it('carries a zero Toman fee through as a zero USD fee', () => {
      const result = normalizeTransactionPrice({
        price: '234000',
        fee: '0',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        tomanPerUsdt: RATE
      });

      expect(result.fee).toBe('0');
      expect(result.enteredFee).toBe('0');
    });

    it('leaves an absent fee absent rather than inventing a zero', () => {
      const result = normalizeTransactionPrice({
        price: '234000',
        fee: null,
        priceCurrency: TransactionPriceCurrency.TOMAN,
        tomanPerUsdt: RATE
      });

      expect(result.fee).toBeNull();
      expect(result.enteredFee).toBeNull();
    });

    it('does not require a rate for a USD entry', () => {
      expect(() =>
        normalizeTransactionPrice({
          price: '1',
          fee: null,
          priceCurrency: TransactionPriceCurrency.USD,
          tomanPerUsdt: null
        })
      ).not.toThrow();
    });

    it.each([
      ['a missing rate', null],
      ['a zero rate', '0'],
      ['a negative rate', '-1']
    ])('refuses to convert a Toman entry with %s', (_label, rate) => {
      expect(() =>
        normalizeTransactionPrice({
          price: '234000',
          fee: null,
          priceCurrency: TransactionPriceCurrency.TOMAN,
          tomanPerUsdt: rate
        })
      ).toThrow(/positive USDT\/Toman rate/);
    });
  });

  /**
   * The property that makes the whole model work: the same trade entered in
   * either currency has to reach the ledger as the same USD cost basis, since
   * that is the only figure the P&L engine sees.
   */
  describe('economic equivalence', () => {
    it('records the same USD basis whichever currency the user typed', () => {
      const inToman = normalizeTransactionPrice({
        price: usdToToman('1.5', RATE),
        fee: usdToToman('0.25', RATE),
        priceCurrency: TransactionPriceCurrency.TOMAN,
        tomanPerUsdt: RATE
      });

      expect(inToman.price).toBe('1.5');
      expect(inToman.fee).toBe('0.25');
    });

    // Step 4's worked example: 100 USDT at 234,000 with a 50,000 fee.
    it('produces a USD basis matching the Toman total', () => {
      const { price, fee } = normalizeTransactionPrice({
        price: '234000',
        fee: '50000',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        tomanPerUsdt: RATE
      });

      // 100 × 0.99736168 + 0.21311147 = 99.94927947 USD, which is
      // 23,450,000 Toman at this rate — the same trade, in the other currency.
      expect(price).toBe('0.99736168');
      expect(fee).toBe('0.21311147');
    });
  });
});
