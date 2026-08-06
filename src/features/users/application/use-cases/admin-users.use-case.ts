import { Inject, Injectable } from '@nestjs/common';
import {
  decodeCursor,
  encodeCursor,
  isValidUUID
} from '@core/pagination/cursor.util';
import { paginate } from '@core/pagination/paginate.util';
import { ADMIN_USERS_PAGE_SIZE_DEFAULT } from '../../presentation/dto/request/admin-users-list.request.dto';
import { UserErrors } from '../../domain/errors/user-errors';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/enums/user-role.enum';
import {
  IAdminUsersUseCase,
  IUserRepository,
  PaginatedResult,
  USER_REPOSITORY
} from '../interfaces/users.interface';

/**
 * Reads of the *user* population, and only that population.
 *
 * Administrators and the owner are not users with extra rights here — they are
 * a separate population reached through the administrator endpoints. Scoping
 * every read to `USER` is what stops them appearing in user management, and it
 * does so in the query rather than by filtering afterwards, so a new caller
 * cannot forget the filter.
 */
@Injectable()
export class AdminUsersUseCase implements IAdminUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async list(cursor?: string, limit?: number): Promise<PaginatedResult<User>> {
    const take = limit ?? ADMIN_USERS_PAGE_SIZE_DEFAULT;
    const cursorId = this.parseCursor(cursor);

    const items = await this.userRepository.findUsersByRole(
      UserRole.USER,
      cursorId,
      take + 1
    );

    return paginate(items, take, (user) => encodeCursor(user.id));
  }

  /**
   * An administrator or the owner answers "not found" rather than "forbidden":
   * a distinct response would confirm that the identifier belongs to a
   * privileged account, which is exactly what an enumeration attempt is looking
   * for.
   */
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findUserForAdmin(id);

    if (!user || user.role !== UserRole.USER) {
      throw UserErrors.userNotFound(id);
    }

    return user;
  }

  private parseCursor(cursor?: string): string | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = decodeCursor(cursor);
    } catch {
      throw UserErrors.invalidCursor();
    }

    if (!isValidUUID(decoded)) {
      throw UserErrors.invalidCursor();
    }

    return decoded;
  }
}
