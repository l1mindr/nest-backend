import { USERNAME_REGEX } from '@core/validation/rules/username.rules';
import {
  buildMessage,
  matches,
  ValidateBy,
  ValidationOptions
} from 'class-validator';

const IS_USERNAME_KEY = 'isUsername';

const isUsername = (value: string): boolean => matches(value, USERNAME_REGEX);

export const IsUsername = (
  validationOptions?: ValidationOptions
): PropertyDecorator => {
  return ValidateBy({
    name: IS_USERNAME_KEY,
    validator: {
      validate: (value): boolean => isUsername(value),
      defaultMessage: buildMessage(
        (eachPrefix) => `${eachPrefix}$property must be a valid`,
        validationOptions
      )
    }
  });
};
