import {
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';

@ValidatorConstraint({ name: 'FutureDate', async: false })
export class FutureDateValidator implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value) return true;

    const date = new Date(value);

    return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
  }

  defaultMessage(): string {
    return 'Date must be in the future';
  }
}
