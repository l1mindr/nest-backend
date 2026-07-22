import {
  ISessionsService,
  SESSION_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { User } from '@features/users/entities/user.entity';
import {
  IUsersService,
  PaginatedResult
} from '@features/users/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsSelect,
  MoreThan,
  Repository
} from 'typeorm';
import { ADMIN_USERS_PAGE_SIZE_DEFAULT } from './dto/request/admin-users-list.request.dto';
import { CreateUserRequestDto } from './dto/request/create-user.request.dto';
import { UpdateProfileRequestDto } from './dto/request/update-profile.request.dto';
import { UserErrors } from './errors/user-errors';

@Injectable()
export class UsersService implements IUsersService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(SESSION_SERVICE)
    private readonly sessionsService: ISessionsService
  ) {}

  /**
   * Every field AdminUserResponseDto serializes: `name` is `select: false`
   * on the entity and the timestamps live under the embedded registryDates,
   * so both must be selected explicitly.
   */
  private static readonly ADMIN_VIEW_SELECT: FindOptionsSelect<User> = {
    id: true,
    name: true,
    username: true,
    email: true,
    role: true,
    status: true,
    registryDates: { createdAt: true, updatedAt: true, deleteAt: true }
  };

  private get userRepo(): Repository<User> {
    return this.dataSource.getRepository(User);
  }

  private findByIdWithSelect(
    id: string,
    select: FindOptionsSelect<User>
  ): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select
    });
  }

  async findByIdentifierForAuth(identifier: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: [{ email: identifier }, { username: identifier }],
      select: {
        id: true,
        password: true,
        status: true
      }
    });
  }

  async findByIdWithPassword(userId: string): Promise<User | null> {
    return this.findByIdWithSelect(userId, { id: true, password: true });
  }

  async findById(id: string): Promise<User> {
    const user = await this.findByIdWithSelect(id, { id: true });
    if (!user) throw UserErrors.userNotFound(id);
    return user;
  }

  async findByIdForAdmin(id: string): Promise<User> {
    const user = await this.findByIdWithSelect(
      id,
      UsersService.ADMIN_VIEW_SELECT
    );
    if (!user) throw UserErrors.userNotFound(id);
    return user;
  }

  async listForAdmin(
    cursor?: string,
    limit?: number
  ): Promise<PaginatedResult<User>> {
    const take = limit ?? ADMIN_USERS_PAGE_SIZE_DEFAULT;
    const cursorId = this.decodeCursor(cursor);

    const items = await this.userRepo.find({
      select: UsersService.ADMIN_VIEW_SELECT,
      where: cursorId ? { id: MoreThan(cursorId) } : undefined,
      order: { id: 'ASC' },
      take: take + 1
    });

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore
      ? this.encodeCursor(page[page.length - 1].id)
      : null;

    return { items: page, nextCursor };
  }

  async setPassword(
    userId: string,
    hashPassword: string,
    manager?: EntityManager
  ): Promise<void> {
    const repository = manager?.getRepository(User) ?? this.userRepo;

    await repository.update({ id: userId }, { password: hashPassword });
  }

  async register(createUserRequestDto: CreateUserRequestDto): Promise<void> {
    try {
      await this.userRepo.save(this.userRepo.create(createUserRequestDto));
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
    }
  }

  async updateProfile(
    id: string,
    updateUserRequestDto: UpdateProfileRequestDto
  ): Promise<void> {
    try {
      await this.findById(id);
      await this.userRepo.update({ id }, updateUserRequestDto);
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
    }
  }

  async requestAccountDeletion(userId: string): Promise<void> {
    const user = await this.findById(userId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).softRemove(user);
      await this.sessionsService.revokeAllForUser(userId, manager);
    });
  }

  private handleUniqueConstraintError(error: unknown): never {
    // PostgreSQL unique constraint violation
    if (isDatabaseError(error) && error.code === '23505') {
      const detail = error.detail ?? '';

      if (detail.includes('email')) throw UserErrors.emailAlreadyExists();

      if (detail.includes('username')) throw UserErrors.usernameAlreadyExists();
    }

    throw error;
  }

  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    if (!UsersService.UUID_RE.test(decoded)) {
      throw UserErrors.invalidCursor();
    }

    return decoded;
  }
}

/**
 * Minimal shape of a node-postgres driver error. Narrowed from `unknown` so
 * the unique-constraint handling stays type-safe without resorting to `any`.
 */
interface DatabaseError {
  code?: string;
  detail?: string;
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return typeof error === 'object' && error !== null && 'code' in error;
}
