import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PortfolioValuationStatus } from '../../../domain/enums/portfolio-valuation-status.enum';

/** One holding's contribution to a portfolio valuation. */
export class PortfolioHoldingValuationDto {
  @ApiProperty({
    description: 'Identifier of the holding, as a UUID.',
    format: 'uuid',
    example: ExampleValue.HOLDING_ID
  })
  @Expose()
  holdingId!: string;

  @ApiProperty({
    description: 'Identifier of the held asset.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @Expose()
  assetId!: string;

  @ApiProperty({
    description: 'Ticker symbol of the held asset, lowercase.',
    example: 'btc'
  })
  @Expose()
  symbol!: string;

  @ApiProperty({
    description: 'Human-readable name of the held asset.',
    example: 'Bitcoin'
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description:
      'Amount of the asset held, as a decimal string with up to 18 fractional digits.',
    type: String,
    example: '0.500000000000000000'
  })
  @Expose()
  amount!: string;

  @ApiProperty({
    description:
      'Last synchronised price of the asset in the valuation currency, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '96785.25'
  })
  @Expose()
  currentPrice!: string | null;

  @ApiProperty({
    description:
      'Value of the holding (`amount × currentPrice`), or `null` when no price is available. Computed with exact decimal arithmetic.',
    type: String,
    nullable: true,
    example: '48392.625'
  })
  @Expose()
  value!: string | null;
}

/** A computed valuation of one portfolio source. */
export class PortfolioValuationResponseDto {
  @ApiProperty({
    description: 'Identifier of the valued portfolio source.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID
  })
  @Expose()
  portfolioId!: string;

  @ApiProperty({
    description: 'ISO 4217 currency code of every price and value.',
    example: 'USD'
  })
  @Expose()
  currency!: string;

  @ApiProperty({
    description:
      'Sum of every valued holding, or `null` when no holding could be valued. Computed with exact decimal arithmetic.',
    type: String,
    nullable: true,
    example: '60000.5'
  })
  @Expose()
  totalValue!: string | null;

  @ApiProperty({
    description:
      '`COMPLETE` when every holding has a price, `PARTIAL` when only some do, `UNAVAILABLE` when none do, and `EMPTY` when the portfolio holds nothing.',
    enum: PortfolioValuationStatus,
    enumName: 'PortfolioValuationStatus',
    example: PortfolioValuationStatus.COMPLETE
  })
  @Expose()
  status!: PortfolioValuationStatus;

  @ApiProperty({
    description: 'Number of holdings that could be valued.',
    type: Number,
    example: 2
  })
  @Expose()
  valuedHoldings!: number;

  @ApiProperty({
    description: 'Number of holdings without a usable price.',
    type: Number,
    example: 0
  })
  @Expose()
  unvaluedHoldings!: number;

  @ApiProperty({
    description: 'Per-holding valuation lines.',
    type: PortfolioHoldingValuationDto,
    isArray: true
  })
  @Expose()
  @Type(() => PortfolioHoldingValuationDto)
  holdings!: PortfolioHoldingValuationDto[];
}
