import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export const SUSPENSION_REASON_MIN_LENGTH = 3;
export const SUSPENSION_REASON_MAX_LENGTH = 500;

export class SuspendUserRequestDto {
  @ApiProperty({
    description:
      'Why the account is being suspended. Quoted verbatim in the notification email sent to the user, so write it for that audience.',
    example: 'Repeated violations of the acceptable use policy.',
    minLength: SUSPENSION_REASON_MIN_LENGTH,
    maxLength: SUSPENSION_REASON_MAX_LENGTH
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(SUSPENSION_REASON_MIN_LENGTH)
  @MaxLength(SUSPENSION_REASON_MAX_LENGTH)
  reason!: string;
}
