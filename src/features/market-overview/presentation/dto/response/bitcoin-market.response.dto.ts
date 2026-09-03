import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Live Bitcoin/USD ticker, fetched directly from CoinGecko rather than the
 * hourly-synchronised asset catalogue — see `BitcoinMarketEntry`.
 */
export class BitcoinMarketResponseDto {
  @ApiProperty({
    description: 'Current Bitcoin price in USD.',
    type: String,
    example: '112345.67000000'
  })
  @Expose()
  priceUsd!: string;

  @ApiProperty({
    description:
      'Relative price change over the last 24 hours, as a percentage.',
    type: String,
    example: '1.24'
  })
  @Expose()
  priceChangePercentage24h!: string;

  @ApiProperty({
    description:
      'Instant at which the provider last updated this price — not when this API fetched it, since the response may be served from a short-lived cache.',
    format: 'date-time',
    example: '2026-08-02T14:35:00.000Z'
  })
  @Expose()
  updatedAt!: Date;

  @ApiProperty({
    description:
      'Instant at which this backend last successfully fetched the price from the provider. Distinct from `updatedAt`: this is when the cache entry being served was populated, not when the provider itself last updated the price.',
    format: 'date-time',
    example: '2026-08-02T14:35:20.000Z'
  })
  @Expose()
  fetchedAt!: Date;

  @ApiProperty({
    description:
      'True when the provider call for this request failed and a previously-cached value is being served instead of failing the request outright. Always `false` for a freshly-fetched or still-fresh cached response.',
    example: false
  })
  @Expose()
  isStale!: boolean;
}
