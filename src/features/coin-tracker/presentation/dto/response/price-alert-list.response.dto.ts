import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { ApiProperty } from '@nestjs/swagger';
import { PriceAlertResponseDto } from './price-alert.response.dto';

export class PriceAlertListResponseDto {
  @ApiProperty({
    description:
      'Alerts on this page. Only alerts owned by the authenticated user are ever returned.',
    type: [PriceAlertResponseDto]
  })
  items!: PriceAlertResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
