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
      'Instant at which the provider computed this snapshot — not when this API fetched it, since the response may be served from a short-lived cache.',
    format: 'date-time',
    example: '2026-08-02T14:35:00.000Z'
  })
  @Expose()
  updatedAt!: Date;
}
