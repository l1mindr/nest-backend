import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { ApiProperty } from '@nestjs/swagger';
import { SessionResponseDto } from './session.response.dto';

export class SessionListResponseDto {
  @ApiProperty({
    description:
      'The session the request itself was made with. Returned separately because it is excluded from `items`, and because revoking it signs the caller out.',
    type: SessionResponseDto
  })
  currentSession!: SessionResponseDto;

  @ApiProperty({
    description:
      'Other sessions of the account, most recently active first. Never contains `currentSession`.',
    type: [SessionResponseDto]
  })
  items!: SessionResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
