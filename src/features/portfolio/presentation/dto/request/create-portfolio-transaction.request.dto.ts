import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength
} from 'class-validator';
import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { IsDecimalString } from '../../validators/decimal-string.validator';

const PRICE_MAX_FRACTION_DIGITS = 8;
const FEE_MAX_FRACTION_DIGITS = 8;

export class CreatePortfolioTransactionRequestDto {
  @ApiProperty({
    description: 'UUID of the traded asset.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @IsString()
  @IsUUID()
  assetId!: string;

  @ApiProperty({
    description: 'Type of the transaction.',
    enum: PortfolioTransactionType,
    example: PortfolioTransactionType.BUY
  })
  @IsEnum(PortfolioTransactionType)
  type!: PortfolioTransactionType;

  @ApiProperty({
    description:
      'Amount of the asset the transaction concerns, as a decimal string with at most 18 fractional digits.',
    type: String,
    example: '0.5'
  })
  @IsDecimalString()
  amount!: string;

  @ApiPropertyOptional({
    description:
      'Price per unit at the time of the trade, as a decimal string with at most 8 fractional digits. Required for `BUY` and `SELL`, ignored otherwise.',
    type: String,
    nullable: true,
    example: '60000.50'
  })
  @IsOptional()
  @IsDecimalString({ maxFractionDigits: PRICE_MAX_FRACTION_DIGITS })
  price?: string;

  @ApiPropertyOptional({
    description:
      'Fee paid for the trade, as a non-negative decimal string with at most 8 fractional digits.',
    type: String,
    nullable: true,
    example: '0.75'
  })
  @IsOptional()
  @IsDecimalString({
    maxFractionDigits: FEE_MAX_FRACTION_DIGITS,
    allowZero: true
  })
  fee?: string;

  @ApiProperty({
    description:
      'Instant at which the transaction took place, as an ISO 8601 timestamp. Kept as the user supplied it; the value is never rewritten from a live price.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional({
    description: 'Free-form note about the transaction.',
    nullable: true,
    maxLength: 1000
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
