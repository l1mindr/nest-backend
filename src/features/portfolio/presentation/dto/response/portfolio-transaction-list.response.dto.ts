import { ApiProperty } from '@nestjs/swagger';
import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { PortfolioTransactionResponseDto } from './portfolio-transaction.response.dto';

export class PortfolioTransactionListResponseDto {
  @ApiProperty({
    description: 'Transactions recorded against the portfolio source.',
    type: [PortfolioTransactionResponseDto]
  })
  items!: PortfolioTransactionResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
