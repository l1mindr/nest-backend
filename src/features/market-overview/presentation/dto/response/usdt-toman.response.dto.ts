import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** Live USDT price in Iranian Toman, from an Iranian exchange. */
export class UsdtTomanResponseDto {
  @ApiProperty({
    description:
      'Current USDT price in Iranian **Toman** (not Rial), as an integer-valued decimal string.',
    type: String,
    example: '123450'
  })
  @Expose()
  priceToman!: string;

  @ApiProperty({
    description:
      'Relative change of the Toman price over the last 24 hours, as a percentage. `0` when the provider omits it.',
    type: String,
    example: '0.6200'
  })
  @Expose()
  priceChangePercentage24h!: string;

  @ApiProperty({
    description:
      'Instant at which this rate was read from the provider. The upstream publishes no timestamp of its own for this market, so this is the read time rather than a venue-reported tick.',
    format: 'date-time',
    example: '2026-08-02T14:35:00.000Z'
  })
  @Expose()
  updatedAt!: Date;

  @ApiProperty({
    description:
      'Instant at which this backend last successfully fetched the rate from the provider.',
    format: 'date-time',
    example: '2026-08-02T14:35:20.000Z'
  })
  @Expose()
  fetchedAt!: Date;

  @ApiProperty({
    description:
      'True when the provider call for this request failed and a previously-cached value is being served instead of failing the request outright.',
    example: false
  })
  @Expose()
  isStale!: boolean;
}
