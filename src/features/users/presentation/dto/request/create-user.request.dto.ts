import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { EmailField } from '@presentation/validation/fields/email-field.decorator';
import { PasswordField } from '@presentation/validation/fields/password-field.decorator';
import { UsernameField } from '@presentation/validation/fields/username-field.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Maximum accepted display name length, enforced by `@MaxLength`. */
export const USER_NAME_MAX_LENGTH = 30;

/**
 * Internal account-creation shape.
 *
 * Not bound to any route: registration goes through
 * `RegisterUserRequestDto`, which omits `status`. It reaches the public
 * schema only through `UpdateProfileRequestDto`, which picks `name` from it.
 */
export class CreateUserRequestDto {
  @EmailField()
  email!: string;

  @UsernameField()
  username!: string;

  @PasswordField()
  password!: string;

  @ApiPropertyOptional({
    description:
      'Initial moderation state. Defaults to `PENDING_VERIFICATION`, which is what registration always creates.',
    enum: UserStatus,
    enumName: 'UserStatus',
    default: UserStatus.PENDING_VERIFICATION,
    example: UserStatus.PENDING_VERIFICATION
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description:
      'Role tier the account is created with. Defaults to `USER`. Only the invitation-acceptance flow sets anything else, and `OWNER` is refused there.',
    enum: UserRole,
    enumName: 'UserRole',
    default: UserRole.USER,
    example: UserRole.USER
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Display name shown on the profile.',
    type: String,
    nullable: true,
    maxLength: USER_NAME_MAX_LENGTH,
    example: ExampleValue.NAME
  })
  @IsOptional()
  @IsString()
  @MaxLength(USER_NAME_MAX_LENGTH)
  name?: string | null;
}
