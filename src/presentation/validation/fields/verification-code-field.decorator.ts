import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export const VERIFICATION_CODE_LENGTH = 6;

const VERIFICATION_CODE_REGEX = new RegExp(
  `^\\d{${VERIFICATION_CODE_LENGTH}}$`
);

export function VerificationCodeField() {
  return applyDecorators(
    ApiProperty({
      description:
        'Verification code emailed to the account. Exactly six digits, single-use, and valid for three minutes.',
      example: ExampleValue.VERIFICATION_CODE,
      minLength: VERIFICATION_CODE_LENGTH,
      maxLength: VERIFICATION_CODE_LENGTH,
      pattern: VERIFICATION_CODE_REGEX.source,
      writeOnly: true
    }),
    IsString(),
    Matches(VERIFICATION_CODE_REGEX, {
      message: `Verification code must be exactly ${VERIFICATION_CODE_LENGTH} digits`
    })
  );
}
