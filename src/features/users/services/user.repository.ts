import { User } from '@features/users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsSelect,
  MoreThan,
  Repository
} from 'typeorm';
import { CreateUserRequestDto } from '../dto/request/create-user.request.dto';
import { UpdateProfileRequestDto } from '../dto/request/update-profile.request.dto';
import { IUserRepository } from '../interfaces/users.interface';

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

  async create(dto: CreateUserRequestDto): Promise<void> {
    await this.userRepo.save(this.userRepo.create(dto));
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: { id: true }
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
    return this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, password: true }
    });
  }

  async findByIdForAdmin(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: UserRepository.ADMIN_VIEW_SELECT
    });
  }

  async findForAdmin(cursorId: string | null, limit: number): Promise<User[]> {
    return this.userRepo.find({
      select: UserRepository.ADMIN_VIEW_SELECT,
      where: cursorId ? { id: MoreThan(cursorId) } : undefined,
      order: { id: 'ASC' },
      take: limit
    });
  }

  async update(id: string, dto: UpdateProfileRequestDto): Promise<void> {
    await this.userRepo.update({ id }, dto);
  }

  async setPassword(
    userId: string,
    hashPassword: string,
    manager?: EntityManager
  ): Promise<void> {
    const repository = manager?.getRepository(User) ?? this.userRepo;
    await repository.update({ id: userId }, { password: hashPassword });
  }
}
