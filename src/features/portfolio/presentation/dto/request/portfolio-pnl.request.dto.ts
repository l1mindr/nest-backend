import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CostBasisStrategy } from '../../../domain/calculation/types/cost-basis.strategy.enum';

/** Query parameters for `GET /v1/portfolios/:portfolioId/pnl`. */
export class PortfolioPnlRequestDto {
  @ApiPropertyOptional({
    description:
      'Cost-basis strategy used to release acquisition cost on disposal. Defaults to `AVERAGE`, preserving the behavior of the calculation engine.',
    enum: CostBasisStrategy,
    default: CostBasisStrategy.AVERAGE
  })
  @IsOptional()
  @IsEnum(CostBasisStrategy)
  costBasis?: CostBasisStrategy;
}
