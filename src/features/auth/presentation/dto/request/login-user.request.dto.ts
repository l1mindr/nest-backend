import { PasswordField } from '@infrastructure/http/validation/fields/password-field.decorator';
import { TrimLowercase } from '@infrastructure/http/validation/decorators/trim-lowercase.decorator';
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
  @TrimLowercase()
  email: string;

  @PasswordField()
  password: string;
}
