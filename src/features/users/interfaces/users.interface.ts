import { CreateUserRequestDto } from '../dto/request/create-user.request.dto';
import { UpdateProfileRequestDto } from '../dto/request/update-profile.request.dto';
import { User } from '../entities/user.entity';
import type { EntityManager } from 'typeorm';
import type { PaginatedResult } from '@core/pagination/paginated-result.interface';

export type { PaginatedResult } from '@core/pagination/paginated-result.interface';

export const USER_SERVICE = Symbol('IUsersService');

export interface IUsersService {
  register(dto: CreateUserRequestDto): Promise<void>;
  listForAdmin(cursor?: string, limit?: number): Promise<PaginatedResult<User>>;
  findByIdForAdmin(id: string): Promise<User>;
  findByIdentifierForAuth(identifier: string): Promise<User | null>;
  findByIdWithPassword(userId: string): Promise<User | null>;
  findById(id: string): Promise<User>;
  updateProfile(
    userId: string,
    updateUserRequestDto: UpdateProfileRequestDto
  ): Promise<void>;
  setPassword(
    userId: string,
    hashPassword: string,
    manager?: EntityManager
  ): Promise<void>;
  requestAccountDeletion(userId: string): Promise<void>;
}
