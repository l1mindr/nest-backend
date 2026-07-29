import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { TrimLowercase } from '../decorators/trim-lowercase.decorator';

export function EmailField() {
  return applyDecorators(
    ApiProperty({
      description: 'A valid email address for the user',
      example: 'test@gmail.com'
    }),
    TrimLowercase(),
    IsString(),
    IsEmail()
  );
}
