import { PasswordField } from '@infrastructure/http/validation/fields/password-field.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginUserRequestDto {
  @ApiProperty({
    description:
      'The email address or username of the user, must be a non-empty string.',
    example: 'user@example.com'
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value.trim().toLowerCase())
  email: string;

  @PasswordField()
  password: string;
}
