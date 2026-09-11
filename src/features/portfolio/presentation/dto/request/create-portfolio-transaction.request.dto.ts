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
import { TransactionPriceCurrency } from '../../../domain/enums/transaction-price-currency.enum';
import { TransferDestinationType } from '../../../domain/enums/transfer-destination-type.enum';
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
      'Fee paid for the trade, as a non-negative decimal string with at most 8 fractional digits. Denominated in `priceCurrency`, not independently.',
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

  @ApiPropertyOptional({
    description: [
      'Currency `price` and `fee` are expressed in. Defaults to `USD`, which is what every transaction recorded before this field existed means, so omitting it preserves the previous behaviour exactly.',
      '',
      'With `TOMAN`, `price` is Toman per one unit of the asset and `fee` is a Toman amount. Both are converted to USD at the live USDT/Toman rate before storage — the portfolio is valued in USD — and the values as entered, along with the rate used, are kept on the transaction so it always reads back in the currency it was created in.',
      '',
      'The rate is read server-side from the same source as `GET /v1/market/usdt-toman`; it is never taken from the request. Only `BUY` and `SELL` accept a currency, since no other type records a price.'
    ].join('\n'),
    enum: TransactionPriceCurrency,
    default: TransactionPriceCurrency.USD,
    example: TransactionPriceCurrency.TOMAN
  })
  @IsOptional()
  @IsEnum(TransactionPriceCurrency)
  priceCurrency?: TransactionPriceCurrency;

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

  @ApiPropertyOptional({
    description:
      'Where a TRANSFER_IN/TRANSFER_OUT counterparty sits. Required for those types, ignored otherwise.',
    enum: TransferDestinationType,
    example: TransferDestinationType.EXCHANGE
  })
  @IsOptional()
  @IsEnum(TransferDestinationType)
  destinationType?: TransferDestinationType;

  @ApiPropertyOptional({
    description:
      'Exchange name. Required when `destinationType` is EXCHANGE, ignored otherwise.',
    maxLength: 255,
    example: 'Binance'
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  exchangeName?: string;

  @ApiPropertyOptional({
    description: 'On-chain transaction id. Always optional.',
    maxLength: 255,
    example: '0x9f2c...'
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  txid?: string;

  @ApiPropertyOptional({
    description:
      'UUID of a wallet registered by the caller. Required when `destinationType` is WALLET, ignored otherwise.',
    format: 'uuid',
    example: ExampleValue.WALLET_ID
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  walletId?: string;
}
