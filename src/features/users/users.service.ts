import {
  ISessionsService,
  SESSION_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { User } from '@features/users/entities/user.entity';
import { IUsersService } from '@features/users/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsSelect,
  Repository
} from 'typeorm';
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

  async listForAdmin(): Promise<User[]> {
    return this.userRepo.find({ select: UsersService.ADMIN_VIEW_SELECT });
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
