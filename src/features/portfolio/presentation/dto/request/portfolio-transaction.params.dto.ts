import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { ExampleValue } from '@presentation/swagger/openapi.constants';

/** Route parameters for endpoints addressing every transaction of a portfolio. */
export class PortfolioTransactionParamsDto {
  @ApiProperty({
    description:
      'Identifier of the portfolio source, as returned in `id` by `GET /v1/portfolios`.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID
  })
  @IsString()
  @IsUUID()
  readonly portfolioId!: string;
}

/** Route parameters for endpoints addressing a single portfolio transaction. */
export class PortfolioTransactionIdParamsDto extends PortfolioTransactionParamsDto {
  @ApiProperty({
    description:
      'Identifier of the transaction, as returned in `id` by `GET /v1/portfolios/:portfolioId/transactions`.',
    format: 'uuid',
    example: ExampleValue.HOLDING_ID
  })
  @IsString()
  @IsUUID()
  readonly id!: string;
}
