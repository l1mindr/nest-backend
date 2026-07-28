import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionResponseDto } from './session.response.dto';

export class SessionListResponseDto {
  @ApiProperty({ type: SessionResponseDto })
  currentSession!: SessionResponseDto;

  @ApiProperty({
    description: 'List of active sessions',
    type: [SessionResponseDto]
  })
  items!: SessionResponseDto[];

  @ApiPropertyOptional({
    description:
      'Opaque cursor for the next page. Omitted when there are no more results.',
    example: undefined
  })
  nextCursor?: string | null;
}
