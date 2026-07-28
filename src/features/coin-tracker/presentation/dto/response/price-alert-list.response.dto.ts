import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriceAlertResponseDto } from './price-alert.response.dto';

export class PriceAlertListResponseDto {
  @ApiProperty({
    description: 'List of price alerts',
    type: [PriceAlertResponseDto]
  })
  items!: PriceAlertResponseDto[];

  @ApiPropertyOptional({
    description:
      'Opaque cursor for the next page. Omitted when there are no more results.'
  })
  nextCursor?: string | null;
}
