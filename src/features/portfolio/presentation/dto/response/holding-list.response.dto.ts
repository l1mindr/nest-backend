import { ApiProperty } from '@nestjs/swagger';
import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { HoldingResponseDto } from './holding.response.dto';

export class HoldingListResponseDto {
  @ApiProperty({
    description: 'Holdings owned by the caller.',
    type: [HoldingResponseDto]
  })
  items!: HoldingResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
