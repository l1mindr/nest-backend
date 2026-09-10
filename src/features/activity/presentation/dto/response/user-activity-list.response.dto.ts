import { ApiProperty } from '@nestjs/swagger';
import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { UserActivityResponseDto } from './user-activity.response.dto';

export class UserActivityListResponseDto {
  @ApiProperty({
    description:
      'One page of the authenticated user’s activities, newest first. Records older than 30 days are removed automatically and never appear here.',
    type: [UserActivityResponseDto]
  })
  items: UserActivityResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor: string | null;
}
