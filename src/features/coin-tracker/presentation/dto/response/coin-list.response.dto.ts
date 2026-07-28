import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoinResponseDto } from './coin.response.dto';

export class CoinListResponseDto {
  @ApiProperty({
    description: 'List of coins',
    type: [CoinResponseDto]
  })
  items!: CoinResponseDto[];

  @ApiPropertyOptional({
    description:
      'Opaque cursor for the next page. Omitted when there are no more results.'
  })
  nextCursor?: string | null;
}
