import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminUserResponseDto } from './admin-user.response.dto';

export class AdminUsersListResponseDto {
  @ApiProperty({
    description: 'List of users',
    type: [AdminUserResponseDto]
  })
  items!: AdminUserResponseDto[];

  @ApiPropertyOptional({
    description:
      'Cursor for the next page. Omitted when there are no more results.',
    example: undefined
  })
  nextCursor?: string | null;
}
