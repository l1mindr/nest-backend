import { PasswordField } from '@core/common/decorators/fields/password-field.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginUserRequestDto {
  @ApiProperty({
    description:
      'The email address or username of the user, must be a non-empty string.',
    example: 'user@example.com'
  })
  @IsNotEmpty()
  @IsString()
  readonly email: string;

  @PasswordField()
  readonly password: string;
}
