import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class HoldingsListRequestDto {
  @ApiPropertyOptional({
    description: 'Filter by portfolio UUID.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  portfolioId?: string;
}
