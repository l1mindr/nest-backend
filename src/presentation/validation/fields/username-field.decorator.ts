import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_REGEX
} from '@core/validation/rules/username.rules';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsUsername } from '../decorators/is-username.decorator';
import { TrimLowercase } from '../decorators/trim-lowercase.decorator';

/**
 * The documented constraints are derived from `USERNAME_REGEX` itself, so the
 * schema can never drift from what `@IsUsername()` actually enforces.
 */
export function UsernameField() {
  return applyDecorators(
    ApiProperty({
      description:
        'Unique username. Letters, digits, dots and underscores only; it may not start or end with a dot, nor contain two consecutive dots. Trimmed and lowercased before validation, so the stored value is always lowercase.',
      example: ExampleValue.USERNAME,
      minLength: USERNAME_MIN_LENGTH,
      maxLength: USERNAME_MAX_LENGTH,
      pattern: USERNAME_REGEX.source
    }),
    TrimLowercase(),
    IsString(),
    IsUsername()
  );
}
