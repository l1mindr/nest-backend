import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** A supported cryptocurrency in the synchronised CoinGecko catalogue. */
export class AssetResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Identifier of the asset, as a UUID.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description:
      'CoinGecko identifier. The value CoinGecko uses to identify the asset, unique across the catalogue.',
    example: 'bitcoin'
  })
  @Expose()
  coinGeckoId!: string;

  @ApiProperty({
    description: 'Ticker symbol, lowercase.',
    example: 'btc'
  })
  @Expose()
  symbol!: string;

  @ApiProperty({
    description: 'Human-readable name.',
    example: 'Bitcoin'
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description:
      'Absolute URL of the asset logo, or `null` when CoinGecko supplies none.',
    type: String,
    nullable: true,
    example: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png'
  })
  @Expose()
  imageUrl!: string | null;

  @ApiProperty({
    description:
      'Current price in the default quote currency, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '96785.25'
  })
  @Expose()
  currentPrice!: string | null;

  @ApiProperty({
    description:
      'Total market capitalisation, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '1912345678901.23'
  })
  @Expose()
  marketCap!: string | null;

  @ApiProperty({
    description:
      'Rank of the asset by market capitalisation, or `null` when CoinGecko did not report one.',
    type: Number,
    nullable: true,
    example: 1
  })
  @Expose()
  marketCapRank!: number | null;

  @ApiProperty({
    description:
      'Trading volume over the last 24 hours, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '48210987654.32'
  })
  @Expose()
  totalVolume!: string | null;

  @ApiProperty({
    description:
      'Number of coins in circulation, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '19758964.00'
  })
  @Expose()
  circulatingSupply!: string | null;

  @ApiProperty({
    description:
      'Total number of coins that exist, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '21000000.00'
  })
  @Expose()
  totalSupply!: string | null;

  @ApiProperty({
    description:
      'Maximum number of coins that can ever exist, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '21000000.00'
  })
  @Expose()
  maxSupply!: string | null;

  @ApiProperty({
    description:
      'Absolute price change over the last 24 hours, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '1524.10'
  })
  @Expose()
  priceChange24h!: string | null;

  @ApiProperty({
    description:
      'Relative price change over the last 24 hours, as a percentage, or `null` when CoinGecko did not report one.',
    type: String,
    nullable: true,
    example: '1.6032'
  })
  @Expose()
  priceChangePercentage24h!: string | null;

  @ApiProperty({
    description:
      'Instant of the last successful synchronisation with CoinGecko.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  lastSyncedAt!: Date;
}
