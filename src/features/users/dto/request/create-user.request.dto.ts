import { IsPassword } from '@core/validators/decorators/is-password.decorator';
import { IsUsername } from '@core/validators/decorators/is-username.decorator';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';

export class CreateUserRequestDto {
  @ApiProperty({
    description: 'A valid email address for the user',
    example: 'test@gmail.com'
  })
  @Transform(({ value }) => value.trim().toLowerCase())
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Username consisting of lowercase characters, numbers, & special characters (_), with a length between 3 and 30 characters',
    example: 'test_122'
  })
  @Transform(({ value }) => value.trim().toLowerCase())
  @IsUsername()
  username: string;

  @ApiProperty({
    description:
      'Password must include numbers, letters, special characters (@#$%^!&*(_+)=), and must be between 8 and 20 characters long',
    example: 'test@1234'
  })
  @IsPassword()
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
