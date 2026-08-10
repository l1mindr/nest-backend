import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { IsDecimalString } from '../../validators/decimal-string.validator';

const PRICE_MAX_FRACTION_DIGITS = 8;
const FEE_MAX_FRACTION_DIGITS = 8;

export class UpdatePortfolioTransactionRequestDto {
  @ApiPropertyOptional({
    description: 'Type of the transaction.',
    enum: PortfolioTransactionType,
    example: PortfolioTransactionType.BUY
  })
  @IsOptional()
  @IsEnum(PortfolioTransactionType)
  type?: PortfolioTransactionType;

  @ApiPropertyOptional({
    description:
      'Amount of the asset the transaction concerns, as a decimal string with at most 18 fractional digits.',
    type: String,
    example: '0.5'
  })
  @IsOptional()
  @IsDecimalString()
  amount?: string;

  @ApiPropertyOptional({
    description:
      'Price per unit at the time of the trade, as a decimal string with at most 8 fractional digits. Required for `BUY` and `SELL`, pass `null` to clear for transfers.',
    type: String,
    nullable: true,
    example: '60000.50'
  })
  @IsOptional()
  @IsDecimalString({ maxFractionDigits: PRICE_MAX_FRACTION_DIGITS })
  price?: string | null;

  @ApiPropertyOptional({
    description:
      'Fee paid for the trade, as a non-negative decimal string with at most 8 fractional digits. Pass `null` to clear.',
    type: String,
    nullable: true,
    example: '0.75'
  })
  @IsOptional()
  @IsDecimalString({
    maxFractionDigits: FEE_MAX_FRACTION_DIGITS,
    allowZero: true
  })
  fee?: string | null;

  @ApiPropertyOptional({
    description:
      'Instant at which the transaction took place, as an ISO 8601 timestamp.',
    format: 'date-time',
    example: '2026-07-28T08:00:00.000Z'
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({
    description: 'Free-form note about the transaction. Pass `null` to clear.',
    nullable: true,
    maxLength: 1000
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
