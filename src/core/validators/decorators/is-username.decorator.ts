import {
  buildMessage,
  matches,
  ValidateBy,
  ValidationOptions
} from 'class-validator';
import { USERNAME_REGEX } from '../rules/username.rules';

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
