import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { RealizedPnlEventResponseDto } from './realized-pnl-event.response.dto';

/** One asset position of a portfolio P&L calculation. */
export class PortfolioPnlPositionResponseDto {
  @ApiProperty({
    description: 'Identifier of the traded asset, as a UUID.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @Expose()
  assetId!: string;

  @ApiProperty({
    description: 'Ticker symbol of the traded asset, lowercase.',
    example: 'btc'
  })
  @Expose()
  symbol!: string;

  @ApiProperty({
    description: 'Human-readable name of the traded asset.',
    example: 'Bitcoin'
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description:
      'Quantity currently held, as a decimal string computed by the calculation engine.',
    type: String,
    example: '1.5'
  })
  @Expose()
  quantity!: string;

  @ApiProperty({
    description:
      'Acquisition cost still pooled in the position, as a decimal string.',
    type: String,
    example: '85000'
  })
  @Expose()
  totalCost!: string;

  @ApiProperty({
    description:
      'Average acquisition cost per unit (`totalCost / quantity`), as a decimal string; `0` when nothing is held.',
    type: String,
    example: '56666.666666666666666666666666'
  })
  @Expose()
  averageCost!: string;

  @ApiProperty({
    description:
      'Last synchronised price of the asset in the valuation currency, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '60000.00000000'
  })
  @Expose()
  currentPrice!: string | null;

  @ApiProperty({
    description:
      'Value of the position (`quantity × currentPrice`), or `null` when the asset has no current price. Never `0` for a missing price.',
    type: String,
    nullable: true,
    example: '90000'
  })
  @Expose()
  currentValue!: string | null;

  @ApiProperty({
    description:
      'Sum of every realized P&L event of the position, as a decimal string. May be negative. Available even when the position is fully sold or unpriced.',
    type: String,
    example: '5000'
  })
  @Expose()
  realizedPnl!: string;

  @ApiProperty({
    description:
      'Unrealized P&L (`currentValue − totalCost`), or `null` when the asset has no current price.',
    type: String,
    nullable: true,
    example: '5000'
  })
  @Expose()
  unrealizedPnl!: string | null;

  @ApiProperty({
    description:
      'Total P&L (`realizedPnl + unrealizedPnl`), or `null` when the asset has no current price.',
    type: String,
    nullable: true,
    example: '10000'
  })
  @Expose()
  totalPnl!: string | null;

  @ApiProperty({
    description:
      'Realized P&L events, one per SELL, in chronological processing order. `TRANSFER_IN` and `TRANSFER_OUT` never appear here.',
    type: RealizedPnlEventResponseDto,
    isArray: true
  })
  @Expose()
  @Type(() => RealizedPnlEventResponseDto)
  realizedPnlEvents!: RealizedPnlEventResponseDto[];
}
