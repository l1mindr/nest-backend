import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { CostBasisStrategy } from '../../../domain/calculation/types/cost-basis.strategy.enum';
import { PortfolioPnlPositionResponseDto } from './portfolio-pnl-position.response.dto';

/** The P&L of one portfolio source, computed on demand. */
export class PortfolioPnlResponseDto {
  @ApiProperty({
    description: 'Identifier of the computed portfolio source, as a UUID.',
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
      'Cost-basis strategy used to release acquisition cost on disposal.',
    enum: CostBasisStrategy,
    enumName: 'CostBasisStrategy',
    example: CostBasisStrategy.AVERAGE
  })
  @Expose()
  costBasis!: CostBasisStrategy;

  @ApiProperty({
    description: 'Number of positions with a usable current price.',
    type: Number,
    example: 2
  })
  @Expose()
  pricedPositions!: number;

  @ApiProperty({
    description: 'Number of positions without a usable current price.',
    type: Number,
    example: 0
  })
  @Expose()
  unpricedPositions!: number;

  @ApiProperty({
    description:
      'Sum of every priced position value, or `null` when any position is unpriced. An empty portfolio reports `"0"`.',
    type: String,
    nullable: true,
    example: '96000'
  })
  @Expose()
  totalCurrentValue!: string | null;

  @ApiProperty({
    description:
      'Sum of every position acquisition cost, as a decimal string. Always available.',
    type: String,
    example: '85000'
  })
  @Expose()
  totalCostBasis!: string;

  @ApiProperty({
    description:
      'Sum of every position realized P&L, as a decimal string. Always available, even when some positions are unpriced.',
    type: String,
    example: '5000'
  })
  @Expose()
  totalRealizedPnl!: string;

  @ApiProperty({
    description:
      'Sum of every position unrealized P&L, or `null` when any position is unpriced.',
    type: String,
    nullable: true,
    example: '6000'
  })
  @Expose()
  totalUnrealizedPnl!: string | null;

  @ApiProperty({
    description:
      'Total P&L (`totalRealizedPnl + totalUnrealizedPnl`), or `null` when any position is unpriced.',
    type: String,
    nullable: true,
    example: '11000'
  })
  @Expose()
  totalPnl!: string | null;

  @ApiProperty({
    description: 'Per-asset P&L positions.',
    type: PortfolioPnlPositionResponseDto,
    isArray: true
  })
  @Expose()
  @Type(() => PortfolioPnlPositionResponseDto)
  positions!: PortfolioPnlPositionResponseDto[];
}
