import {
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';

const DECIMAL_FORMAT = /^\d+(\.\d{1,18})?$/;
const ZERO_PATTERN = /^0+(\.0+)?$/;

@ValidatorConstraint({ name: 'IsDecimalString', async: false })
export class DecimalStringValidator implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      DECIMAL_FORMAT.test(value) &&
      !ZERO_PATTERN.test(value)
    );
  }

  defaultMessage(): string {
    return 'amount must be a positive decimal number with at most 18 fractional digits';
  }
}

export function IsDecimalString(): PropertyDecorator {
  return Validate(DecimalStringValidator);
}
