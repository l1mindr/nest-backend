import { ApiProperty } from '@nestjs/swagger';
import { IsDecimalString } from '../../validators/decimal-string.validator';

const OPENING_COST_MAX_FRACTION_DIGITS = 26;

export class SetPortfolioOpeningBalanceRequestDto {
  @ApiProperty({
    description:
      'Quantity held before the recorded transaction ledger, as a non-negative decimal string with up to 18 fractional digits.',
    type: String,
    example: '1.500000000000000000'
  })
  @IsDecimalString({ allowZero: true })
  openingQuantity!: string;

  @ApiProperty({
    description:
      'Acquisition cost of the opening quantity, as a non-negative decimal string with up to 26 fractional digits.',
    type: String,
    example: '90000'
  })
  @IsDecimalString({
    maxFractionDigits: OPENING_COST_MAX_FRACTION_DIGITS,
    allowZero: true
  })
  openingCost!: string;
}
