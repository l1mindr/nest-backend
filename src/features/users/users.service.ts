import { CreateUserDto } from '@features/users/dto/create-user.dto';
import { UpdateUserDto } from '@features/users/dto/update-user.dto';
import { User } from '@features/users/entities/user.entity';
import { IUsersService } from '@features/users/interfaces/users.interface';
import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { DataSource, FindOptionsSelect, Repository } from 'typeorm';

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
      select: { id: true, password: true, status: true }
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
    if (!user) throw new NotFoundException();
    return user;
  }

  async setPassword(userid: string, hashPassword: string): Promise<void> {
    await this.userRepo.update({ id: userid }, { password: hashPassword });
  }

  async register(createUserDto: CreateUserDto): Promise<void> {
    try {
      const user = this.userRepo.create(createUserDto);
      await this.userRepo.save(user);
    } catch (error: any) {
      this.handleUniqueConstraintError(error);
    }
  }

  async list(): Promise<User[]> {
    return this.userRepo.find();
  }

  async updateProfile(id: string, updateUserDto: UpdateUserDto): Promise<void> {
    try {
      await this.findById(id);
      await this.userRepo.update({ id }, updateUserDto);
    } catch (error: any) {
      this.handleUniqueConstraintError(error);
    }
  }

  async requestAccountDeletion(userId: string): Promise<void> {
    const user = await this.findById(userId);
    await this.userRepo.softRemove(user);
  }

  private handleUniqueConstraintError(error: any) {
    // PostgreSQL unique constraint violation
    if (error.code === '23505') {
      const detail: string = error.detail ?? '';

      if (detail.includes('email'))
        throw new UnprocessableEntityException('email already exists');

      if (detail.includes('username'))
        throw new UnprocessableEntityException('username already exists');
    }

    throw error;
  }
}
