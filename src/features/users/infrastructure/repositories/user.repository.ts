import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { User } from '@features/users/domain/entities/user.entity';
import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsSelect,
  LessThan,
  MoreThan,
  Repository
} from 'typeorm';
import { CreateUserRequestDto } from '../../presentation/dto/request/create-user.request.dto';
import { UpdateProfileRequestDto } from '../../presentation/dto/request/update-profile.request.dto';
import { IUserRepository } from '../../application/interfaces/users.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  private get userRepo(): Repository<User> {
    return this.dataSource.getRepository(User);
  }

  constructor(private readonly dataSource: DataSource) {}

  private static readonly ADMIN_VIEW_SELECT: FindOptionsSelect<User> = {
    id: true,
    name: true,
    username: true,
    email: true,
    role: true,
    status: true,
    registryDates: { createdAt: true, updatedAt: true, deleteAt: true }
  };

  async insertUser(
    dto: CreateUserRequestDto,
    manager?: EntityManager
  ): Promise<User> {
    const repository = manager?.getRepository(User) ?? this.userRepo;

    return repository.save(repository.create(dto));
  }

  /**
   * Existence check. `role` is carried alongside the identifier because the
   * callers that use this to confirm an account exists are also the ones that
   * must refuse to act on the owner, and a second query for one column would be
   * a round trip spent on nothing.
   */
  async findUserById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: { id: true, role: true }
    });
  }

  async findUserForTokenValidation(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        status: true,
        role: true,
        registryDates: { createdAt: true }
      }
    });
  }

  async findByEmailOrUsernameForAuth(identifier: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: [{ email: identifier }, { username: identifier }],
      select: {
        id: true,
        email: true,
        password: true,
        status: true,
        registryDates: { createdAt: true }
      }
    });
  }

  async findUserWithPassword(userId: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, password: true }
    });
  }

  async findUserForAdmin(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: UserRepository.ADMIN_VIEW_SELECT
    });
  }

  async findUsersForAdmin(
    cursorId: string | null,
    limit: number
  ): Promise<User[]> {
    return this.userRepo.find({
      select: UserRepository.ADMIN_VIEW_SELECT,
      where: cursorId ? { id: MoreThan(cursorId) } : undefined,
      order: { id: 'ASC' },
      take: limit
    });
  }

  /**
   * Cursor-paginated over one role tier, ordered by identifier — the same
   * contract as {@link findUsersForAdmin}, narrowed to a role so the
   * administrator directory does not have to page through every account.
   */
  async findUsersByRole(
    role: UserRole,
    cursorId: string | null,
    limit: number
  ): Promise<User[]> {
    return this.userRepo.find({
      select: UserRepository.ADMIN_VIEW_SELECT,
      where: cursorId ? { role, id: MoreThan(cursorId) } : { role },
      order: { id: 'ASC' },
      take: limit
    });
  }

  async updateUserProfile(
    id: string,
    dto: UpdateProfileRequestDto
  ): Promise<void> {
    await this.userRepo.update({ id }, dto);
  }

  async updateRole(
    userId: string,
    role: UserRole,
    manager?: EntityManager
  ): Promise<void> {
    const repository = manager?.getRepository(User) ?? this.userRepo;
    await repository.update({ id: userId }, { role });
  }

  async updateStatus(
    userId: string,
    status: string,
    manager?: EntityManager
  ): Promise<void> {
    const repository = manager?.getRepository(User) ?? this.userRepo;
    await repository.update({ id: userId }, { status: status as any });
  }

  async updatePasswordHash(
    userId: string,
    hashPassword: string,
    manager?: EntityManager
  ): Promise<void> {
    const repository = manager?.getRepository(User) ?? this.userRepo;
    await repository.update({ id: userId }, { password: hashPassword });
  }

  async findPendingOlderThan(cutoff: Date): Promise<User[]> {
    return this.userRepo.find({
      where: {
        status: UserStatus.PENDING_VERIFICATION,
        registryDates: { createdAt: LessThan(cutoff) }
      },
      select: {
        id: true,
        email: true,
        status: true,
        registryDates: { createdAt: true }
      }
    });
  }
}
