import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailResponseDto {
  @ApiProperty({
    description: 'Confirmation message',
    example: 'Email verified successfully'
  })
  message: string;
}
