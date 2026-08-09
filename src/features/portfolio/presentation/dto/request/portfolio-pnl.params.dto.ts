import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { ExampleValue } from '@presentation/swagger/openapi.constants';

/** Route parameters for `GET /v1/portfolios/:portfolioId/pnl`. */
export class PortfolioPnlParamsDto {
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
