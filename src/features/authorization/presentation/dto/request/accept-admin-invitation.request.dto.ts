import { USER_NAME_MAX_LENGTH } from '@features/users/presentation/dto/request/create-user.request.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { PasswordField } from '@presentation/validation/fields/password-field.decorator';
import { UsernameField } from '@presentation/validation/fields/username-field.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Base64url of 32 random bytes. */
const TOKEN_MIN_LENGTH = 40;
const TOKEN_MAX_LENGTH = 64;

/**
 * Accepting an invitation is where the administrator account is created, so it
 * carries the credentials rather than an identifier. The email is not accepted
 * from the client: it comes from the invitation, which is what the token proves.
 */
export class AcceptAdminInvitationRequestDto {
  @ApiProperty({
    description:
      'The single-use token from the invitation email. Presenting it proves the caller controls the invited address.',
    minLength: TOKEN_MIN_LENGTH,
    maxLength: TOKEN_MAX_LENGTH,
    example: 'x7Qk2m9YbR4tG1hV8sN0wP3jL6cA5dE2fU9iO4yZ1kM'
  })
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  @MaxLength(TOKEN_MAX_LENGTH)
  readonly token!: string;

  @UsernameField()
  readonly username!: string;

  @PasswordField()
  readonly password!: string;

  @ApiPropertyOptional({
    description: 'Display name shown on the administrator profile.',
    type: String,
    maxLength: USER_NAME_MAX_LENGTH,
    example: ExampleValue.NAME
  })
  @IsOptional()
  @IsString()
  @MaxLength(USER_NAME_MAX_LENGTH)
  readonly name?: string;
}
