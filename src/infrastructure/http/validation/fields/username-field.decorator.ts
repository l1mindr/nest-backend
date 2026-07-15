import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsUsername } from '../decorators/is-username.decorator';
import { TrimLowercase } from '../decorators/trim-lowercase.decorator';

export function UsernameField() {
  return applyDecorators(
    ApiProperty({
      description:
        'Username consisting of lowercase characters, numbers, & special characters (_), with a length between 3 and 30 characters',
      example: 'test_122'
    }),
    TrimLowercase(),
    IsString(),
    IsUsername()
  );
}
