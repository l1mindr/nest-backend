import { CreateUserRequestDto } from '../dto/request/create-user.request.dto';
import { UpdateProfileRequestDto } from '../dto/request/update-profile.request.dto';
import { User } from '../entities/user.entity';
import type { EntityManager } from 'typeorm';
import type { PaginatedResult } from '@core/pagination/paginated-result.interface';

export type { PaginatedResult } from '@core/pagination/paginated-result.interface';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface IUserRepository {
  insertUser(dto: CreateUserRequestDto): Promise<void>;
  findUserById(id: string): Promise<User | null>;
  findUserForTokenValidation(id: string): Promise<User | null>;
  findByEmailOrUsernameForAuth(identifier: string): Promise<User | null>;
  findUserWithPassword(userId: string): Promise<User | null>;
  findUserForAdmin(id: string): Promise<User | null>;
  findUsersForAdmin(cursorId: string | null, limit: number): Promise<User[]>;
  updateUserProfile(id: string, dto: UpdateProfileRequestDto): Promise<void>;
  updatePasswordHash(
    userId: string,
    hashPassword: string,
    manager?: EntityManager
  ): Promise<void>;
}

export const USER_QUERY_SERVICE = Symbol('IUserQueryService');

export interface IUserQueryService {
  findById(id: string): Promise<User | null>;
  findByEmailOrUsername(identifier: string): Promise<User | null>;
  findForTokenValidation(id: string): Promise<User | null>;
}

export const CREATE_USER_SERVICE = Symbol('ICreateUserService');

export interface ICreateUserService {
  create(dto: CreateUserRequestDto): Promise<void>;
}

export const UPDATE_PROFILE_SERVICE = Symbol('IUpdateProfileService');

export interface IUpdateProfileService {
  update(userId: string, dto: UpdateProfileRequestDto): Promise<void>;
}

export const DELETE_ACCOUNT_SERVICE = Symbol('IDeleteAccountService');

export interface IDeleteAccountService {
  remove(userId: string): Promise<void>;
}

export const ADMIN_USERS_SERVICE = Symbol('IAdminUsersService');

export interface IAdminUsersService {
  list(cursor?: string, limit?: number): Promise<PaginatedResult<User>>;
  findById(id: string): Promise<User>;
}
