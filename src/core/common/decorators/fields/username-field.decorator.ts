import { IsUsername } from '@core/validators/decorators/is-username.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export function UsernameField() {
  return applyDecorators(
    ApiProperty({
      description:
        'Username consisting of lowercase characters, numbers, & special characters (_), with a length between 3 and 30 characters',
      example: 'test_122'
    }),
    Transform(({ value }) => value.trim().toLowerCase()),
    IsUsername()
  );
}
