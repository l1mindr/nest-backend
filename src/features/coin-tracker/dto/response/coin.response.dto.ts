import { TimestampResponseDto } from '@infrastructure/http/serialization/dto/timestamp-response.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CoinResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'CoinGecko identifier',
    example: 'bitcoin'
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Ticker symbol',
    example: 'btc'
  })
  @Expose()
  symbol!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'Bitcoin'
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description: 'URL of the coin image',
    nullable: true
  })
  @Expose()
  image!: string | null;

  @ApiProperty({
    description: 'Whether the coin is actively synced'
  })
  @Expose()
  isActive!: boolean;

  @ApiProperty({
    description: 'Timestamp of the last successful synchronization'
  })
  @Expose()
  lastSyncedAt!: Date;
}
