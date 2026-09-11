import { MarketOverviewErrorCode } from '../../../domain/errors/market-overview-error-code.enum';
import {
  RIAL_PER_TOMAN,
  TOMAN_PER_TOMAN,
  toPercentageChange,
  toTomanPrice
} from '../usdt-toman.normalizer';

const invalidResponse = expect.objectContaining({
  code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_INVALID_RESPONSE
});

describe('usdt-toman normalizer', () => {
  describe('toTomanPrice', () => {
    it('converts a Rial quote to Toman', () => {
      expect(toTomanPrice('2346190', RIAL_PER_TOMAN)).toBe('234619');
    });

    it('passes a Toman quote through unscaled', () => {
      expect(toTomanPrice('234251', TOMAN_PER_TOMAN)).toBe('234251');
    });

    it('trims the trailing zeros Wallex pads its prices with', () => {
      expect(toTomanPrice('234251.0000000000000000', TOMAN_PER_TOMAN)).toBe(
        '234251'
      );
    });

    it('accepts a numeric quote as well as a string one', () => {
      expect(toTomanPrice(2_346_190, RIAL_PER_TOMAN)).toBe('234619');
    });

    // The unit guard: if a venue is ever found to quote Toman already, the
    // divisor corrects it without a code change — so it has to apply.
    it('honours the configured divisor', () => {
      expect(toTomanPrice('234619', '1')).toBe('234619');
      expect(toTomanPrice('2346190', '100')).toBe('23461.9');
    });

    // The reason this does not go through `latest / 10`: the float division
    // and the `.toFixed(0)` rounding that followed it both lost digits.
    describe('precision', () => {
      it('keeps a Rial quote that does not divide evenly, without rounding', () => {
        expect(toTomanPrice('2346195', RIAL_PER_TOMAN)).toBe('234619.5');
      });

      it('holds a price far beyond the safe-integer range exactly', () => {
        // 2^53 is where JS numbers start skipping integers; the string path
        // does not care.
        expect(toTomanPrice('90071992547409910', RIAL_PER_TOMAN)).toBe(
          '9007199254740991'
        );
        expect(toTomanPrice('90071992547409930', RIAL_PER_TOMAN)).toBe(
          '9007199254740993'
        );
      });

      // Dividing by a power of ten always terminates, so the exact quotient is
      // returned and the non-terminating cap never comes into play.
      it('preserves every digit of a high-precision quote', () => {
        expect(toTomanPrice('2346190.123456789', RIAL_PER_TOMAN)).toBe(
          '234619.0123456789'
        );
      });

      it('caps a non-terminating quotient instead of looping', () => {
        expect(toTomanPrice('2346190', '3')).toBe('782063.33333333');
      });

      it.each([
        ['2346190', '234619'],
        ['2346191', '234619.1'],
        ['2346199', '234619.9'],
        ['1', '0.1'],
        ['10000000', '1000000']
      ])('converts %s Rial to %s Toman', (rial, toman) => {
        expect(toTomanPrice(rial, RIAL_PER_TOMAN)).toBe(toman);
      });
    });

    it.each([
      ['a zero price', '0'],
      ['a zero price as a number', 0],
      ['a padded zero price', '0.0000000000000000'],
      ['a negative price', '-5'],
      ['a negative price as a number', -2_346_190],
      ['a non-numeric string', 'abc'],
      ['an empty string', ''],
      ['a whitespace-only string', '   '],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['null', null],
      ['undefined', undefined],
      ['an object', { latest: 1 }],
      ['a boolean', true],
      // Would silently become 1e+21 Toman if it were coerced through String().
      ['a number in exponent notation', 1e21]
    ])('rejects %s', (_label, value) => {
      expect(() => toTomanPrice(value, RIAL_PER_TOMAN)).toThrow(
        invalidResponse
      );
    });
  });

  describe('toPercentageChange', () => {
    it('renders a change at a fixed scale of four digits', () => {
      expect(toPercentageChange('0.62')).toBe('0.6200');
      expect(toPercentageChange('3.3')).toBe('3.3000');
    });

    it('accepts the JSON number Wallex sends', () => {
      expect(toPercentageChange(2.88)).toBe('2.8800');
    });

    it('preserves a negative change', () => {
      expect(toPercentageChange('-1.5')).toBe('-1.5000');
      expect(toPercentageChange(-0.04)).toBe('-0.0400');
    });

    it('truncates rather than rounds beyond four digits', () => {
      expect(toPercentageChange('1.239999')).toBe('1.2399');
    });

    it('does not render a negative zero', () => {
      expect(toPercentageChange('-0.00001')).toBe('0.0000');
    });

    it.each([
      ['an absent change', undefined],
      ['a null change', null],
      ['a non-numeric change', 'n/a'],
      ['NaN', Number.NaN]
    ])('degrades %s to zero rather than failing the rate', (_label, value) => {
      expect(toPercentageChange(value)).toBe('0.0000');
    });
  });
});
