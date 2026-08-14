import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDecimalString } from '../../validators/decimal-string.validator';
import { Trim } from '@presentation/validation/decorators/trim.decorator';

export class UpdateHoldingRequestDto {
  @ApiPropertyOptional({
    type: String,
    example: '2.5'
  })
  @IsOptional()
  @IsDecimalString()
  amount?: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 1000
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
