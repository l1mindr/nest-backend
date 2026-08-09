import { AssetResponseDto } from '@features/assets/presentation/dto/response/asset.response.dto';
import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/** One asset held by the authenticated user in one portfolio. */
export class HoldingResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Identifier of the holding, as a UUID.',
    format: 'uuid',
    example: ExampleValue.HOLDING_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Identifier of the portfolio the holding belongs to.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID
  })
  @Expose()
  portfolioId!: string;

  @ApiProperty({
    description: 'Identifier of the held asset.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @Expose()
  assetId!: string;

  @ApiProperty({
    description:
      'Amount of the asset held, as a decimal string with up to 18 fractional digits.',
    type: String,
    example: '1.500000000000000000'
  })
  @Expose()
  amount!: string;

  @ApiProperty({
    description: 'Free-form note about the holding, or `null` when not set.',
    type: String,
    nullable: true,
    example: null
  })
  @Expose()
  notes!: string | null;

  @ApiProperty({
    description: 'The held asset, as returned by `GET /v1/assets`.',
    type: AssetResponseDto
  })
  @Expose()
  @Type(() => AssetResponseDto)
  asset!: AssetResponseDto;
}
