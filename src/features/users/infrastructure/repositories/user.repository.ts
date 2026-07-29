import { UserStatus } from '@features/users/domain/enums/user-status.enum';
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

  async insertUser(dto: CreateUserRequestDto): Promise<User> {
    return this.userRepo.save(this.userRepo.create(dto));
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: { id: true }
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

  async updateUserProfile(
    id: string,
    dto: UpdateProfileRequestDto
  ): Promise<void> {
    await this.userRepo.update({ id }, dto);
  }

  async updateStatus(userId: string, status: string): Promise<void> {
    await this.userRepo.update({ id: userId }, { status: status as any });
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
