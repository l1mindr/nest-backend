const DECIMAL_FORMAT = /^\d+(\.\d+)?$/;

interface ParsedDecimal {
  coefficient: bigint;
  scale: number;
}

/**
 * Parses a decimal string into an integer coefficient and a scale.
 *
 * `'123.450'` becomes `{ coefficient: 123450n, scale: 3 }`. No value is
 * coerced through a JavaScript float, so the exact digits are preserved.
 */
function parseDecimal(value: string): ParsedDecimal {
  if (!DECIMAL_FORMAT.test(value)) {
    throw new Error(`Invalid decimal string: ${value}`);
  }

  const [integerPart, fractionPart = ''] = value.split('.');

  return {
    coefficient: BigInt(`${integerPart}${fractionPart}`),
    scale: fractionPart.length
  };
}

/**
 * Renders a coefficient and scale as a decimal string, trimming trailing
 * fractional zeros so `'60000'` is never returned as `'60000.00000000'`.
 */
function formatDecimal(coefficient: bigint, scale: number): string {
  if (scale === 0) {
    return coefficient.toString();
  }

  const digits = coefficient.toString().padStart(scale + 1, '0');
  const integer = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale).replace(/0+$/, '');

  return fraction.length === 0 ? integer : `${integer}.${fraction}`;
}

/**
 * Exact decimal multiplication, as a decimal string.
 *
 * The product of the two scales is preserved in full: `amount × price` keeps
 * up to 26 fractional digits, so no rounding occurs before the value is used.
 */
export function multiplyDecimals(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);

  return formatDecimal(a.coefficient * b.coefficient, a.scale + b.scale);
}

/**
 * Exact decimal summation, as a decimal string.
 *
 * Every value is normalised to the highest scale present before adding, so
 * `'0.1' + '0.2'` is exactly `'0.3'`, never `0.30000000000000004`.
 */
export function sumDecimals(values: string[]): string {
  if (values.length === 0) {
    throw new Error('Cannot sum an empty list of decimals');
  }

  const parsed = values.map(parseDecimal);
  const scale = Math.max(...parsed.map((value) => value.scale));

  const coefficient = parsed.reduce(
    (total, value) =>
      total + value.coefficient * 10n ** BigInt(scale - value.scale),
    0n
  );

  return formatDecimal(coefficient, scale);
}
