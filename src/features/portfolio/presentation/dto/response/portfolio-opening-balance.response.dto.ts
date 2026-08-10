import { AssetResponseDto } from '@features/assets/presentation/dto/response/asset.response.dto';
import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class PortfolioOpeningBalanceResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Identifier of the opening balance, as a UUID.',
    format: 'uuid',
    example: ExampleValue.HOLDING_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Identifier of the portfolio source.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID
  })
  @Expose()
  portfolioId!: string;

  @ApiProperty({
    description: 'Identifier of the asset.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @Expose()
  assetId!: string;

  @ApiProperty({
    description:
      'Quantity held before the recorded transaction ledger, as a decimal string.',
    type: String,
    example: '1.500000000000000000'
  })
  @Expose()
  openingQuantity!: string;

  @ApiProperty({
    description:
      'Acquisition cost of the opening quantity, as a decimal string.',
    type: String,
    example: '90000'
  })
  @Expose()
  openingCost!: string;

  @ApiProperty({
    description: 'The asset resolved from the shared asset catalogue.',
    type: AssetResponseDto
  })
  @Expose()
  @Type(() => AssetResponseDto)
  asset!: AssetResponseDto;
}
