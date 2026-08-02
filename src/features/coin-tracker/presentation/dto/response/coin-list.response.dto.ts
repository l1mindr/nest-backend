import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { ApiProperty } from '@nestjs/swagger';
import { CoinResponseDto } from './coin.response.dto';

export class CoinListResponseDto {
  @ApiProperty({
    description: 'Coins on this page, ordered by the requested sort field.',
    type: [CoinResponseDto]
  })
  items!: CoinResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
