import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { PortfolioSourceType } from '../../../domain/enums/portfolio-source-type.enum';

/** A portfolio source owned by the authenticated user. */
export class PortfolioResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Identifier of the portfolio, as a UUID.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Display name of the portfolio.',
    example: 'My Ledger'
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description: 'Kind of source backing the portfolio.',
    enum: PortfolioSourceType,
    enumName: 'PortfolioSourceType',
    example: PortfolioSourceType.WALLET
  })
  @Expose()
  sourceType!: PortfolioSourceType;

  @ApiProperty({
    description: 'Wallet address, or `null` when not set.',
    type: String,
    nullable: true,
    example: '0x1234...'
  })
  @Expose()
  walletAddress!: string | null;
}
