import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** A cryptocurrency from the synchronised CoinGecko catalogue. */
export class CoinResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description:
      'CoinGecko identifier. This is the value to send as `coinId` when creating a price alert.',
    example: 'bitcoin'
  })
  @Expose()
  id!: string;

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

  @ApiPropertyOptional({
    description:
      'Absolute URL of the coin logo, or `null` when CoinGecko supplies none.',
    type: String,
    format: 'uri',
    nullable: true,
    example: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png'
  })
  @Expose()
  image!: string | null;

  @ApiProperty({
    description:
      'Whether the scheduled synchronisation still refreshes this coin. Alerts can only be created against active coins.',
    example: true
  })
  @Expose()
  isActive!: boolean;

  @ApiProperty({
    description:
      'Instant of the last successful synchronisation with CoinGecko.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  lastSyncedAt!: Date;
}
