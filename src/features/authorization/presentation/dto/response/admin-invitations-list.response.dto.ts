import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { ApiProperty } from '@nestjs/swagger';
import { AdminInvitationResponseDto } from './admin-invitation.response.dto';

export class AdminInvitationsListResponseDto {
  @ApiProperty({
    description: 'Invitations on this page, ordered by identifier.',
    type: [AdminInvitationResponseDto]
  })
  items!: AdminInvitationResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
