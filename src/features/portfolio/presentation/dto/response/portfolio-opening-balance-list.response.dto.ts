import { ApiProperty } from '@nestjs/swagger';
import { PortfolioOpeningBalanceResponseDto } from './portfolio-opening-balance.response.dto';

export class PortfolioOpeningBalanceListResponseDto {
  @ApiProperty({
    description: 'Opening balances owned by the caller for this portfolio.',
    type: [PortfolioOpeningBalanceResponseDto]
  })
  items!: PortfolioOpeningBalanceResponseDto[];
}
