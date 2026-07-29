import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SuspendUserRequestDto {
  @ApiProperty({
    description: 'Reason for the suspension',
    example: 'Violation of terms of service',
    minLength: 3,
    maxLength: 500
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
