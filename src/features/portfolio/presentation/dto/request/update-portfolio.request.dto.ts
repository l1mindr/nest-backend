import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';
import { PortfolioSourceType } from '../../../domain/enums/portfolio-source-type.enum';

export class UpdatePortfolioRequestDto {
  @ApiPropertyOptional({
    description: 'Display name of the portfolio.',
    example: 'My Updated Ledger'
  })
  @IsOptional()
  @Trim()
  @MinLength(1)
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Kind of source backing the portfolio.',
    enum: PortfolioSourceType,
    enumName: 'PortfolioSourceType',
    example: PortfolioSourceType.EXCHANGE
  })
  @IsOptional()
  @IsEnum(PortfolioSourceType)
  sourceType?: PortfolioSourceType;

  @ApiPropertyOptional({
    description: 'Wallet address, or `null` to clear it.',
    nullable: true,
    example: '0x5678...'
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  walletAddress?: string | null;
}
