import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** Total crypto market snapshot, synchronised from CoinGecko's global endpoint. */
export class MarketOverviewResponseDto {
  @ApiProperty({
    description:
      'Total market capitalisation across all tracked cryptocurrencies, in USD.',
    type: String,
    example: '2412345678901.23'
  })
  @Expose()
  totalMarketCapUsd!: string;

  @ApiProperty({
    description:
      'Relative change of the total market capitalisation over the last 24 hours, as a percentage.',
    type: String,
    example: '1.24'
  })
  @Expose()
  marketCapChangePercentage24h!: string;

  @ApiProperty({
    description:
      "Bitcoin's share of the total market capitalisation, as a percentage.",
    type: String,
    example: '51.32'
  })
  @Expose()
  btcDominancePercentage!: string;

  @ApiProperty({
    description:
      "Ethereum's share of the total market capitalisation, as a percentage. Read from the same provider snapshot as `btcDominancePercentage`, so the two are always consistent with each other.",
    type: String,
    example: '17.84'
  })
  @Expose()
  ethDominancePercentage!: string;

  @ApiProperty({
    description:
      'Instant at which the provider computed this snapshot — not when this API fetched it, since the response may be served from a short-lived cache.',
    format: 'date-time',
    example: '2026-08-02T14:35:00.000Z'
  })
  @Expose()
  updatedAt!: Date;

  @ApiProperty({
    description:
      'Instant at which this backend last successfully fetched the snapshot from the provider. Distinct from `updatedAt`: this is when the cache entry being served was populated, not when the provider itself computed the data.',
    format: 'date-time',
    example: '2026-08-02T14:36:12.000Z'
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
