import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { USDT_TOMAN_PROVIDERS } from '../../../infrastructure/usdt-toman/usdt-toman.config';

/** Live USDT price in Iranian Toman, from an Iranian exchange. */
export class UsdtTomanResponseDto {
  @ApiProperty({
    description:
      'Current USDT price in Iranian **Toman** (not Rial), as a decimal string. Normally integer-valued, since the venues quote whole Rial or Toman; a fractional part is possible when a Rial quote does not divide evenly by 10.',
    type: String,
    example: '234619'
  })
  @Expose()
  priceToman!: string;

  @ApiProperty({
    description:
      'The exchange this rate came from. Varies between requests: if the preferred exchange is unavailable the API falls back to the other one, and this reports which actually answered.',
    type: String,
    enum: USDT_TOMAN_PROVIDERS,
    example: 'nobitex'
  })
  @Expose()
  provider!: string;

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
