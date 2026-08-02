import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { ApiProperty } from '@nestjs/swagger';
import { AdminUserResponseDto } from './admin-user.response.dto';

export class AdminUsersListResponseDto {
  @ApiProperty({
    description:
      'Accounts on this page, ordered by identifier. Includes soft-deleted accounts.',
    type: [AdminUserResponseDto]
  })
  items!: AdminUserResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
