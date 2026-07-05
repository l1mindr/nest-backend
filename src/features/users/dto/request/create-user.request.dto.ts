import { UserStatus } from '@features/users/enums/user-status.enum';
import { EmailField } from '@infrastructure/http/validation/fields/email-field.decorator';
import { PasswordField } from '@infrastructure/http/validation/fields/password-field.decorator';
import { UsernameField } from '@infrastructure/http/validation/fields/username-field.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, MaxLength } from 'class-validator';

export class CreateUserRequestDto {
  @EmailField()
  email: string;

  @UsernameField()
  username: string;

  @PasswordField()
  password: string;

  @ApiPropertyOptional({
    enum: UserStatus,
    description:
      "User's current status, possible values: 'ACTIVATE', 'DEACTIVATE', or 'SUSPEND'",
    example: 'ACTIVATE'
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'User name, limited to a maximum of 30 characters',
    example: 'mohmadreza mosalli'
  })
  @IsOptional()
  @MaxLength(30)
  name?: string | null;
}
