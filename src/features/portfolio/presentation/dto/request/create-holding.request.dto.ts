import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { IsDecimalString } from '../../validators/decimal-string.validator';

export class CreateHoldingRequestDto {
  @ApiProperty({
    description: 'UUID of the portfolio to add the holding to.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID
  })
  @IsString()
  @IsUUID()
  portfolioId!: string;

  @ApiProperty({
    description: 'UUID of the asset.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @IsString()
  @IsUUID()
  assetId!: string;

  @ApiProperty({
    description: 'Amount held.',
    type: String,
    example: '1.5'
  })
  @IsDecimalString()
  amount!: string;

  @ApiPropertyOptional({
    description: 'Optional notes.',
    nullable: true,
    maxLength: 1000
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
