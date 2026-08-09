import { ValidationArguments, registerDecorator } from 'class-validator';

const ZERO_PATTERN = /^0+(\.0+)?$/;

export interface IsDecimalStringOptions {
  /**
   * Maximum number of fractional digits allowed. Defaults to 18, matching the
   * `amount` columns (`numeric(36,18)`).
   */
  maxFractionDigits?: number;
  /** Whether `0` (and `0.00` …) is accepted. Defaults to `false`. */
  allowZero?: boolean;
}

/**
 * Validates a decimal string without coercing it through a JavaScript float.
 *
 * The value must be a string of the form `123` or `123.45` with at most
 * `maxFractionDigits` fractional digits. By default zero is rejected so the
 * decorator expresses "positive"; pass `allowZero: true` for non-negative
 * quantities such as fees.
 */
export function IsDecimalString(
  options: IsDecimalStringOptions = {}
): PropertyDecorator {
  const maxFractionDigits = options.maxFractionDigits ?? 18;
  const allowZero = options.allowZero ?? false;

  return (object, propertyName) => {
    registerDecorator({
      name: 'IsDecimalString',
      target: object.constructor,
      propertyName: propertyName as string,
      constraints: [maxFractionDigits, allowZero],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [maxDigits, zeroAllowed] = args.constraints as [
            number,
            boolean
          ];

          if (typeof value !== 'string') {
            return false;
          }

          const format = new RegExp(`^\\d+(\\.\\d{1,${maxDigits}})?$`);

          if (!format.test(value)) {
            return false;
          }

          return zeroAllowed ? true : !ZERO_PATTERN.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          const [maxDigits, zeroAllowed] = args.constraints as [
            number,
            boolean
          ];

          if (zeroAllowed) {
            return `must be a non-negative decimal number with at most ${maxDigits} fractional digits`;
          }

          return `must be a positive decimal number with at most ${maxDigits} fractional digits`;
        }
      }
    });
  };
}
