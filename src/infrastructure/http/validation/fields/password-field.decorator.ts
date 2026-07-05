import { IsPassword } from '@core/validators/decorators/is-password.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';

export function PasswordField(options?: ApiPropertyOptions) {
  return applyDecorators(
    ApiProperty({
      description:
        'Password must include numbers, letters, special characters (@#$%^!&*(_+)=), and must be between 8 and 20 characters long',
      example: 'Test@1234',
      ...options
    }),
    IsPassword()
  );
}
