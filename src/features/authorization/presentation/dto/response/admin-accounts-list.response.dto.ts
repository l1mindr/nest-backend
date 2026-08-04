import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { ApiProperty } from '@nestjs/swagger';
import { AdminAccountResponseDto } from './admin-account.response.dto';

export class AdminAccountsListResponseDto {
  @ApiProperty({
    description: 'Administrators on this page, ordered by identifier.',
    type: [AdminAccountResponseDto]
  })
  items!: AdminAccountResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
