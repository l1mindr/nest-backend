import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { TrimLowercase } from '../decorators/trim-lowercase.decorator';

export function EmailField() {
  return applyDecorators(
    ApiProperty({
      description:
        'Email address of the account. Trimmed and lowercased before validation, so `User@Example.com` and `user@example.com` address the same account.',
      example: ExampleValue.EMAIL,
      format: 'email'
    }),
    TrimLowercase(),
    IsString(),
    IsEmail()
  );
}
