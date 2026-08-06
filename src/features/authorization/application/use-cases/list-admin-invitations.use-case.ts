import {
  decodeCursor,
  encodeCursor,
  isValidUUID
} from '@core/pagination/cursor.util';
import { paginate } from '@core/pagination/paginate.util';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import { Inject, Injectable } from '@nestjs/common';
import { AdminInvitation } from '../../domain/entities/admin-invitation.entity';
import { ADMINS_PAGE_SIZE_DEFAULT } from '../../presentation/dto/request/admin-list.request.dto';
import {
  ADMIN_INVITATION_REPOSITORY,
  IAdminInvitationRepository,
  IListAdminInvitationsUseCase,
  PaginatedResult
} from '../interfaces/authorization.interface';

/** The invitation log, including settled invitations, for the audit trail. */
@Injectable()
export class ListAdminInvitationsUseCase implements IListAdminInvitationsUseCase {
  constructor(
    @Inject(ADMIN_INVITATION_REPOSITORY)
    private readonly invitationRepository: IAdminInvitationRepository
  ) {}

  async execute(
    cursor?: string,
    limit?: number
  ): Promise<PaginatedResult<AdminInvitation>> {
    const take = limit ?? ADMINS_PAGE_SIZE_DEFAULT;

    const invitations = await this.invitationRepository.findPage(
      this.parseCursor(cursor),
      take + 1
    );

    return paginate(invitations, take, (invitation) =>
      encodeCursor(invitation.id)
    );
  }

  private parseCursor(cursor?: string): string | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = decodeCursor(cursor);
    } catch {
      throw UserErrors.invalidCursor();
    }

    if (!isValidUUID(decoded)) throw UserErrors.invalidCursor();

    return decoded;
  }
}
