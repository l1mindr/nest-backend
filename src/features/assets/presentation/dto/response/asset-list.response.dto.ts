import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { ApiProperty } from '@nestjs/swagger';
import { AssetResponseDto } from './asset.response.dto';

export class AssetListResponseDto {
  @ApiProperty({
    description: 'Assets on this page, ordered by identifier.',
    type: [AssetResponseDto]
  })
  items!: AssetResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
