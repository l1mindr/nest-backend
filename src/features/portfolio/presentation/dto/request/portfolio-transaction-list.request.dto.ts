import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min
} from 'class-validator';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';

const PORTFOLIO_TRANSACTIONS_PAGE_SIZE_DEFAULT = 20;
const PORTFOLIO_TRANSACTIONS_PAGE_SIZE_MAX = 100;

export {
  PORTFOLIO_TRANSACTIONS_PAGE_SIZE_DEFAULT,
  PORTFOLIO_TRANSACTIONS_PAGE_SIZE_MAX
};

export class PortfolioTransactionListRequestDto {
  @ApiPropertyOptional({
    ...cursorQueryDocs(),
    description: `${cursorQueryDocs().description} The cursor encodes the \`occurredAt\`/\`id\` boundary of the previous page; it stays valid only while the underlying page remains unchanged.`
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: PORTFOLIO_TRANSACTIONS_PAGE_SIZE_DEFAULT,
      max: PORTFOLIO_TRANSACTIONS_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PORTFOLIO_TRANSACTIONS_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Restrict the result to transactions of one asset.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    description: 'Restrict the result to one transaction type.',
    enum: PortfolioTransactionType
  })
  @IsOptional()
  @IsEnum(PortfolioTransactionType)
  type?: PortfolioTransactionType;

  @ApiPropertyOptional({
    description:
      'Earliest occurrence to include, as an ISO 8601 timestamp, inclusive.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Latest occurrence to include, as an ISO 8601 timestamp, inclusive.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
