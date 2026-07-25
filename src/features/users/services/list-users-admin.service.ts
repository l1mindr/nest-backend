import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_USERS_PAGE_SIZE_DEFAULT } from '../dto/request/admin-users-list.request.dto';
import { UserErrors } from '../errors/user-errors';
import {
  IListUsersAdminService,
  IUserRepository,
  PaginatedResult,
  USER_REPOSITORY
} from '../interfaces/users.interface';
import { User } from '../entities/user.entity';

@Injectable()
export class ListUsersAdminService implements IListUsersAdminService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async list(cursor?: string, limit?: number): Promise<PaginatedResult<User>> {
    const take = limit ?? ADMIN_USERS_PAGE_SIZE_DEFAULT;
    const cursorId = this.decodeCursor(cursor);

    const items = await this.userRepository.findForAdmin(cursorId, take + 1);

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore
      ? this.encodeCursor(page[page.length - 1].id)
      : null;

    return { items: page, nextCursor };
  }

  private encodeCursor(id: string): string {
    return Buffer.from(id, 'utf-8').toString('base64url');
  }

  private decodeCursor(cursor?: string): string | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    } catch {
      throw UserErrors.invalidCursor();
    }

    if (!ListUsersAdminService.UUID_RE.test(decoded)) {
      throw UserErrors.invalidCursor();
    }

    return decoded;
  }
}
