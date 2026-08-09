import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';
import { PortfolioSourceType } from '../../../domain/enums/portfolio-source-type.enum';

export class CreatePortfolioRequestDto {
  @ApiProperty({
    description: 'Display name of the portfolio.',
    example: 'My Ledger'
  })
  @Trim()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Kind of source backing the portfolio.',
    enum: PortfolioSourceType,
    enumName: 'PortfolioSourceType',
    example: PortfolioSourceType.WALLET
  })
  @IsEnum(PortfolioSourceType)
  sourceType!: PortfolioSourceType;

  @ApiPropertyOptional({
    description: 'Wallet address, or `null` when not set.',
    nullable: true,
    example: '0x1234...'
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  walletAddress?: string;
}
