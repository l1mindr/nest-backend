import { ApiProperty } from '@nestjs/swagger';

export const EMAIL_VERIFIED_MESSAGE = 'Email verified successfully';

export class VerifyEmailResponseDto {
  @ApiProperty({
    description:
      'Fixed confirmation string. Carries no data — branch on the `200` status, not on this text.',
    example: EMAIL_VERIFIED_MESSAGE
  })
  message: string;
}
