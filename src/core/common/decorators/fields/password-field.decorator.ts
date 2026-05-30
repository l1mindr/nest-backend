import { IsPassword } from '@core/validators/decorators/is-password.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export function PasswordField() {
  return applyDecorators(
    ApiProperty({
      description:
        'Password must include numbers, letters, special characters (@#$%^!&*(_+)=), and must be between 8 and 20 characters long',
      example: 'test@1234'
    }),
    IsPassword()
  );
}
