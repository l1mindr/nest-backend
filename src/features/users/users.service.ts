import { User } from '@features/users/entities/user.entity';
import { IUsersService } from '@features/users/interfaces/users.interface';
import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsSelect, Repository } from 'typeorm';
import { CreateUserRequestDto } from './dto/request/create-user.request.dto';
import { UpdateProfileRequestDto } from './dto/request/update-profile.request.dto';
import { UserErrors } from './errors/user-errors';

@Injectable()
export class UsersService implements IUsersService {
  constructor(private readonly dataSource: DataSource) {}

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

  async findByIdForSessionValidation(userId: string): Promise<User | null> {
    return this.findByIdWithSelect(userId, {
      id: true,
      email: true,
      username: true,
      name: true,
      status: true,
      role: true,
      registryDates: { createdAt: true }
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

  async setPassword(userid: string, hashPassword: string): Promise<void> {
    await this.userRepo.update({ id: userid }, { password: hashPassword });
  }

  async register(createUserRequestDto: CreateUserRequestDto): Promise<void> {
    try {
      await this.userRepo.save(this.userRepo.create(createUserRequestDto));
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
    }
  }

  async list(): Promise<User[]> {
    return this.userRepo.find();
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
    await this.userRepo.softRemove(user);
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
