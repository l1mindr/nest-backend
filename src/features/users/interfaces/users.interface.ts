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

export const CREATE_USER_SERVICE = Symbol('ICreateUserService');

export interface ICreateUserService {
  createUser(dto: CreateUserRequestDto): Promise<void>;
}

export const UPDATE_PROFILE_SERVICE = Symbol('IUpdateProfileService');

export interface IUpdateProfileService {
  updateProfile(userId: string, dto: UpdateProfileRequestDto): Promise<void>;
}

export const DELETE_ACCOUNT_SERVICE = Symbol('IDeleteAccountService');

export interface IDeleteAccountService {
  deleteAccount(userId: string): Promise<void>;
}

export const LIST_USERS_ADMIN_SERVICE = Symbol('IListUsersAdminService');

export interface IListUsersAdminService {
  listUsers(cursor?: string, limit?: number): Promise<PaginatedResult<User>>;
}

export const FIND_USER_ADMIN_SERVICE = Symbol('IFindUserAdminService');

export interface IFindUserAdminService {
  findUserById(id: string): Promise<User>;
}
