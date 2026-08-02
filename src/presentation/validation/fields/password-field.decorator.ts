import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX
} from '@core/validation/rules/password.rules';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsPassword } from '../decorators/is-password.decorator';

/**
 * The documented constraints are derived from `PASSWORD_REGEX` itself, so the
 * schema can never drift from what `@IsPassword()` actually enforces.
 */
export function PasswordField(options?: ApiPropertyOptions) {
  return applyDecorators(
    ApiProperty({
      description:
        'Account password. Must contain at least one lowercase letter, one uppercase letter, one digit and one non-alphanumeric character.',
      example: ExampleValue.PASSWORD,
      format: 'password',
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_LENGTH,
      pattern: PASSWORD_REGEX.source,
      writeOnly: true,
      ...options
    }),
    IsString(),
    IsPassword()
  );
}
