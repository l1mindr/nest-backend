import {
  compareDecimals,
  divideDecimals,
  isDecimalString,
  multiplyDecimals,
  subtractDecimals,
  sumDecimals
} from '../decimal.util';

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

    it('should reject negative operands', () => {
      expect(() => sumDecimals(['1', '-2'])).toThrow();
    });
  });

  describe('isDecimalString', () => {
    it('should accept integers and decimals', () => {
      expect(isDecimalString('0')).toBe(true);
      expect(isDecimalString('1')).toBe(true);
      expect(isDecimalString('0.5')).toBe(true);
    });

    it('should accept negative values', () => {
      expect(isDecimalString('-1')).toBe(true);
      expect(isDecimalString('-0.25')).toBe(true);
    });

    it('should reject non-decimal input', () => {
      expect(isDecimalString('')).toBe(false);
      expect(isDecimalString('abc')).toBe(false);
      expect(isDecimalString('1.2.3')).toBe(false);
      expect(isDecimalString('1e3')).toBe(false);
      expect(isDecimalString(null)).toBe(false);
      expect(isDecimalString(1)).toBe(false);
    });
  });

  describe('compareDecimals', () => {
    it('should detect equality across scales', () => {
      expect(compareDecimals('1.50', '1.5')).toBe(0);
    });

    it('should order positive values', () => {
      expect(compareDecimals('2', '1.5')).toBe(1);
      expect(compareDecimals('0.1', '0.2')).toBe(-1);
    });

    it('should order negative values', () => {
      expect(compareDecimals('-1', '1')).toBe(-1);
      expect(compareDecimals('-1', '-2')).toBe(1);
    });

    it('should reject malformed input', () => {
      expect(() => compareDecimals('abc', '1')).toThrow();
    });
  });

  describe('subtractDecimals', () => {
    it('should subtract exactly', () => {
      expect(subtractDecimals('1.5', '0.5')).toBe('1');
    });

    it('should trim trailing zeros', () => {
      expect(subtractDecimals('1.00', '0.50')).toBe('0.5');
    });

    it('should support signed results', () => {
      expect(subtractDecimals('1', '2')).toBe('-1');
    });

    it('should reject malformed input', () => {
      expect(() => subtractDecimals('1', 'x')).toThrow();
    });
  });

  describe('divideDecimals', () => {
    it('should divide terminating quotients exactly', () => {
      expect(divideDecimals('120000', '2', 26)).toBe('60000');
      expect(divideDecimals('0.02', '0.2', 26)).toBe('0.1');
      expect(divideDecimals('1', '4', 26)).toBe('0.25');
    });

    it('should divide zero', () => {
      expect(divideDecimals('0', '5', 26)).toBe('0');
    });

    it('should support signed quotients', () => {
      expect(divideDecimals('-1', '2', 26)).toBe('-0.5');
    });

    it('should truncate non-terminating quotients at the requested scale', () => {
      expect(divideDecimals('1', '3', 6)).toBe('0.333333');
    });

    it('should reject division by zero', () => {
      expect(() => divideDecimals('1', '0', 26)).toThrow();
    });
  });
});
