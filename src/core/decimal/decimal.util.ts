const DECIMAL_FORMAT = /^-?\d+(\.\d+)?$/;

interface ParsedDecimal {
  sign: 1 | -1;
  coefficient: bigint;
  scale: number;
}

/**
 * Parses a decimal string into a sign, an integer coefficient and a scale.
 *
 * `'123.450'` becomes `{ sign: 1, coefficient: 123450n, scale: 3 }` and
 * `'-2.5'` becomes `{ sign: -1, coefficient: 25n, scale: 1 }`. No value is
 * coerced through a JavaScript float, so the exact digits are preserved.
 */
function parseDecimal(value: string): ParsedDecimal {
  if (!DECIMAL_FORMAT.test(value)) {
    throw new Error(`Invalid decimal string: ${value}`);
  }

  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  const [integerPart, fractionPart = ''] = digits.split('.');

  return {
    sign: negative ? -1 : 1,
    coefficient: BigInt(`${integerPart}${fractionPart}`),
    scale: fractionPart.length
  };
}

/**
 * Renders a coefficient and scale as a decimal string, trimming trailing
 * fractional zeros so `'60000'` is never returned as `'60000.00000000'`.
 */
function formatDecimal(
  coefficient: bigint,
  scale: number,
  sign: 1 | -1 = 1
): string {
  if (coefficient === 0n) {
    return '0';
  }

  if (scale === 0) {
    return `${sign === -1 ? '-' : ''}${coefficient.toString()}`;
  }

  const digits = coefficient.toString().padStart(scale + 1, '0');
  const integer = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale).replace(/0+$/, '');

  const rendered = fraction.length === 0 ? integer : `${integer}.${fraction}`;

  return sign === -1 ? `-${rendered}` : rendered;
}

/**
 * Guards the accumulating functions against negative operands. Quantities and
 * costs are never allowed to go negative in this module's arithmetic; the
 * comparison/subtraction/division functions are the signed escape hatch.
 */
function assertNonNegative(value: ParsedDecimal): void {
  if (value.sign === -1) {
    throw new Error('Negative decimal values are not supported here');
  }
}

/**
 * Exact decimal multiplication, as a decimal string.
 *
 * The product of the two scales is preserved in full: `amount × price` keeps
 * up to 26 fractional digits, so no rounding occurs before the value is used.
 * Negative operands are rejected.
 */
export function multiplyDecimals(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  assertNonNegative(a);
  assertNonNegative(b);

  return formatDecimal(a.coefficient * b.coefficient, a.scale + b.scale);
}

/**
 * Exact decimal summation, as a decimal string.
 *
 * Every value is normalised to the highest scale present before adding, so
 * `'0.1' + '0.2'` is exactly `'0.3'`, never `0.30000000000000004`. Negative
 * operands are rejected.
 */
export function sumDecimals(values: string[]): string {
  if (values.length === 0) {
    throw new Error('Cannot sum an empty list of decimals');
  }

  const parsed = values.map(parseDecimal);
  parsed.forEach(assertNonNegative);
  const scale = Math.max(...parsed.map((value) => value.scale));

  const coefficient = parsed.reduce(
    (total, value) =>
      total + value.coefficient * 10n ** BigInt(scale - value.scale),
    0n
  );

  return formatDecimal(coefficient, scale);
}

/**
 * Returns true when the value is a syntactically valid decimal string,
 * including a leading minus sign for negative values.
 */
export function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_FORMAT.test(value);
}

/**
 * Compares two decimal strings exactly. Returns `-1`, `0` or `1` when the
 * left value is less than, equal to, or greater than the right value.
 */
export function compareDecimals(left: string, right: string): -1 | 0 | 1 {
  const a = parseDecimal(left);
  const b = parseDecimal(right);

  if (a.sign !== b.sign) {
    return a.sign === -1 ? -1 : 1;
  }

  const scale = Math.max(a.scale, b.scale);
  const aCoefficient = a.coefficient * 10n ** BigInt(scale - a.scale);
  const bCoefficient = b.coefficient * 10n ** BigInt(scale - b.scale);

  if (aCoefficient < bCoefficient) {
    return a.sign === -1 ? 1 : -1;
  }
  if (aCoefficient > bCoefficient) {
    return a.sign === -1 ? -1 : 1;
  }
  return 0;
}

/**
 * Exact decimal subtraction, as a decimal string.
 *
 * Unlike the accumulating functions, the result may be negative, so this is
 * the place to compute differences and (in later milestones) signed P&L.
 */
export function subtractDecimals(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);

  const scale = Math.max(a.scale, b.scale);
  const aCoefficient =
    BigInt(a.sign) * a.coefficient * 10n ** BigInt(scale - a.scale);
  const bCoefficient =
    BigInt(b.sign) * b.coefficient * 10n ** BigInt(scale - b.scale);

  const difference = aCoefficient - bCoefficient;
  const sign: 1 | -1 = difference < 0n ? -1 : 1;

  return formatDecimal(difference < 0n ? -difference : difference, scale, sign);
}

/**
 * Greatest common divisor for the division routine.
 */
function gcd(a: bigint, b: bigint): bigint {
  let left = a;
  let right = b;
  while (right !== 0n) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

/**
 * Exact decimal division, as a decimal string.
 *
 * The quotient is returned exactly (with trailing zeros trimmed) whenever it
 * is a finite decimal, e.g. `'120000' / '2'` is `'60000'` and
 * `'0.02' / '0.2'` is `'0.1'`. When the quotient is non-terminating
 * (e.g. `'1' / '3'`), it is truncated toward zero after `maxFractionDigits`
 * fractional digits; no rounding is applied.
 */
export function divideDecimals(
  dividend: string,
  divisor: string,
  maxFractionDigits: number
): string {
  const a = parseDecimal(dividend);
  const b = parseDecimal(divisor);

  if (b.coefficient === 0n) {
    throw new Error('Cannot divide by zero');
  }

  const sign: 1 | -1 = a.sign === b.sign ? 1 : -1;
  let numerator = a.coefficient * 10n ** BigInt(b.scale);
  let denominator = b.coefficient * 10n ** BigInt(a.scale);

  const common = gcd(numerator, denominator);
  numerator /= common;
  denominator /= common;

  let twos = 0;
  let fives = 0;
  let remainder = denominator;
  while (remainder % 2n === 0n) {
    remainder /= 2n;
    twos += 1;
  }
  while (remainder % 5n === 0n) {
    remainder /= 5n;
    fives += 1;
  }

  if (remainder === 1n) {
    const scale = Math.max(twos, fives);
    const coefficient = (numerator * 10n ** BigInt(scale)) / denominator;
    return formatDecimal(coefficient, scale, sign);
  }

  const coefficient =
    (numerator * 10n ** BigInt(maxFractionDigits)) / denominator;
  return formatDecimal(coefficient, maxFractionDigits, sign);
}
