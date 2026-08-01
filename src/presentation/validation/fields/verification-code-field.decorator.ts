import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const VERIFICATION_CODE_REGEX = /^\d{6}$/;

export function VerificationCodeField() {
  return applyDecorators(
    ApiProperty({
      description: 'Six-digit verification code sent to the user email',
      example: '123456',
      minLength: 6,
      maxLength: 6
    }),
    IsString(),
    Matches(VERIFICATION_CODE_REGEX, {
      message: 'Verification code must be exactly 6 digits'
    })
  );
}
