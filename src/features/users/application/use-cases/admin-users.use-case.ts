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
import {
  IAdminUsersUseCase,
  IUserRepository,
  PaginatedResult,
  USER_REPOSITORY
} from '../interfaces/users.interface';

@Injectable()
export class AdminUsersUseCase implements IAdminUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async list(cursor?: string, limit?: number): Promise<PaginatedResult<User>> {
    const take = limit ?? ADMIN_USERS_PAGE_SIZE_DEFAULT;
    const cursorId = this.parseCursor(cursor);

    const items = await this.userRepository.findUsersForAdmin(
      cursorId,
      take + 1
    );

    return paginate(items, take, (user) => encodeCursor(user.id));
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findUserForAdmin(id);
    if (!user) throw UserErrors.userNotFound(id);
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
