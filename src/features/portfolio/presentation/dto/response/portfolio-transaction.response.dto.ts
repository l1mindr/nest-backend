import { AssetResponseDto } from '@features/assets/presentation/dto/response/asset.response.dto';
import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { TransferDestinationType } from '../../../domain/enums/transfer-destination-type.enum';

/** One transaction recorded against a portfolio source. */
export class PortfolioTransactionResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Identifier of the transaction, as a UUID.',
    format: 'uuid',
    example: ExampleValue.HOLDING_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description:
      'Identifier of the portfolio source the transaction belongs to.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID
  })
  @Expose()
  portfolioId!: string;

  @ApiProperty({
    description: 'Identifier of the traded asset.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @Expose()
  assetId!: string;

  @ApiProperty({
    description: 'Type of the transaction.',
    enum: PortfolioTransactionType,
    example: PortfolioTransactionType.BUY
  })
  @Expose()
  type!: PortfolioTransactionType;

  @ApiProperty({
    description:
      'Amount of the asset the transaction concerns, as a decimal string with up to 18 fractional digits.',
    type: String,
    example: '0.500000000000000000'
  })
  @Expose()
  amount!: string;

  @ApiProperty({
    description:
      'Price per unit at the time of the trade, as a decimal string with up to 8 fractional digits, or `null` when the transaction type has no price.',
    type: String,
    nullable: true,
    example: '60000.50'
  })
  @Expose()
  price!: string | null;

  @ApiProperty({
    description:
      'Fee paid for the trade, as a decimal string with up to 8 fractional digits, or `null` when none was recorded.',
    type: String,
    nullable: true,
    example: '0.75'
  })
  @Expose()
  fee!: string | null;

  @ApiProperty({
    description:
      'Instant at which the transaction took place, as supplied by the user.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  occurredAt!: Date;

  @ApiProperty({
    description:
      'Free-form note about the transaction, or `null` when not set.',
    type: String,
    nullable: true,
    example: null
  })
  @Expose()
  notes!: string | null;

  @ApiProperty({
    description: 'The traded asset, as returned by `GET /v1/assets`.',
    type: AssetResponseDto
  })
  @Expose()
  @Type(() => AssetResponseDto)
  asset!: AssetResponseDto;

  @ApiProperty({
    description:
      'Where a TRANSFER_IN/TRANSFER_OUT counterparty sits, or `null` for BUY/SELL.',
    enum: TransferDestinationType,
    nullable: true,
    example: TransferDestinationType.EXCHANGE
  })
  @Expose()
  destinationType!: TransferDestinationType | null;

  @ApiProperty({
    description: 'Exchange name, or `null` when not applicable.',
    type: String,
    nullable: true,
    example: 'Binance'
  })
  @Expose()
  exchangeName!: string | null;

  @ApiProperty({
    description: 'On-chain transaction id, or `null` when not set.',
    type: String,
    nullable: true,
    example: '0x9f2c...'
  })
  @Expose()
  txid!: string | null;

  @ApiProperty({
    description:
      'UUID of the wallet counterparty, or `null` when not applicable.',
    type: String,
    format: 'uuid',
    nullable: true,
    example: ExampleValue.WALLET_ID
  })
  @Expose()
  walletId!: string | null;
}
