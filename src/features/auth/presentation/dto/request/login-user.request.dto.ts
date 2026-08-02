import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { PasswordField } from '@presentation/validation/fields/password-field.decorator';
import { TrimLowercase } from '@presentation/validation/decorators/trim-lowercase.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginUserRequestDto {
  /**
   * Named `email` for backwards compatibility, but the lookup accepts a
   * username just as well — hence no `@IsEmail()` here.
   */
  @ApiProperty({
    description:
      'Email address **or** username of the account. Trimmed and lowercased before lookup.',
    example: ExampleValue.EMAIL,
    examples: {
      email: { summary: 'By email', value: ExampleValue.EMAIL },
      username: { summary: 'By username', value: ExampleValue.USERNAME }
    }
  })
  @IsNotEmpty()
  @IsString()
  @TrimLowercase()
  email: string;

  /**
   * Documented without the registration constraints on purpose: an existing
   * account may predate a rule change, and advertising the pattern here would
   * invite clients to reject a valid password locally.
   */
  @PasswordField({
    description:
      'Account password. Sent as-is; the strength rules are enforced when the password is set, not when it is used.',
    minLength: undefined,
    maxLength: undefined,
    pattern: undefined
  })
  password: string;
}
