import { multiplyDecimals, sumDecimals } from '../decimal.util';

describe('decimal.util', () => {
  describe('multiplyDecimals', () => {
    it('should multiply integers exactly', () => {
      expect(multiplyDecimals('2', '3')).toBe('6');
    });

    it('should multiply decimal strings without float drift', () => {
      expect(multiplyDecimals('0.1', '0.2')).toBe('0.02');
    });

    it('should preserve the full fractional precision', () => {
      expect(multiplyDecimals('0.5', '96785.25')).toBe('48392.625');
    });

    it('should trim trailing fractional zeros', () => {
      expect(multiplyDecimals('1.5', '60000.00000000')).toBe('90000');
      expect(multiplyDecimals('1.5', '60000')).toBe('90000');
    });

    it('should handle large coefficients', () => {
      expect(multiplyDecimals('999999999999', '999999999999')).toBe(
        '999999999998000000000001'
      );
    });

    it('should multiply by zero', () => {
      expect(multiplyDecimals('0', '123.45')).toBe('0');
    });

    it('should reject non-decimal input', () => {
      expect(() => multiplyDecimals('1.2.3', '2')).toThrow();
      expect(() => multiplyDecimals('-1', '2')).toThrow();
    });
  });

  describe('sumDecimals', () => {
    it('should add integers exactly', () => {
      expect(sumDecimals(['1', '2', '3'])).toBe('6');
    });

    it('should add decimals exactly without float drift', () => {
      expect(sumDecimals(['0.1', '0.2'])).toBe('0.3');
    });

    it('should normalise across different scales', () => {
      expect(sumDecimals(['48392.625', '0.02'])).toBe('48392.645');
    });

    it('should trim trailing fractional zeros', () => {
      expect(sumDecimals(['10000.5', '89999.5'])).toBe('100000');
    });

    it('should reject an empty list', () => {
      expect(() => sumDecimals([])).toThrow();
    });
  });
});
