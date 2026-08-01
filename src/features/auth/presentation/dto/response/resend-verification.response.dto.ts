import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationResponseDto {
  @ApiProperty({
    description:
      'Generic response; the same message is returned whether or not an account exists',
    example:
      'If an account with this email exists, a new verification code has been sent'
  })
  message: string;
}
