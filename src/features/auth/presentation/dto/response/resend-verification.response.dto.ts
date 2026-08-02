import { ApiProperty } from '@nestjs/swagger';

export const RESEND_VERIFICATION_MESSAGE =
  'If an account with this email exists, a new verification code has been sent';

export class ResendVerificationResponseDto {
  @ApiProperty({
    description:
      'Fixed, deliberately non-committal string. It is returned unchanged whether the address is unknown, already verified, or genuinely pending, so the endpoint cannot be used to enumerate accounts.',
    example: RESEND_VERIFICATION_MESSAGE
  })
  message: string;
}
