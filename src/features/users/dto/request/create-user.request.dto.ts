import { EmailField } from '@core/common/decorators/fields/email-field.decorator';
import { PasswordField } from '@core/common/decorators/fields/password-field.decorator';
import { UsernameField } from '@core/common/decorators/fields/username-field.decorator';
import { UserStatus } from '@features/users/enums/user-status.enum';
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
