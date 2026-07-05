import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export function EmailField() {
  return applyDecorators(
    ApiProperty({
      description: 'A valid email address for the user',
      example: 'test@gmail.com'
    }),
    Transform(({ value }) => value.trim().toLowerCase()),
    IsEmail()
  );
}
