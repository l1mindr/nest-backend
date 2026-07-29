import { CreateUserRequestDto } from '../../presentation/dto/request/create-user.request.dto';
import { UpdateProfileRequestDto } from '../../presentation/dto/request/update-profile.request.dto';
import { User } from '../../domain/entities/user.entity';
import { UserVerificationCode } from '../../domain/entities/user-verification-code.entity';
import type { EntityManager } from 'typeorm';
import type { PaginatedResult } from '@core/pagination/paginated-result.interface';

export type { PaginatedResult } from '@core/pagination/paginated-result.interface';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface IUserRepository {
  insertUser(dto: CreateUserRequestDto): Promise<User>;
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
  updateStatus(userId: string, status: string): Promise<void>;
}

export const VERIFICATION_CODE_REPOSITORY = Symbol(
  'IVerificationCodeRepository'
);

export interface IVerificationCodeRepository {
  store(
    userId: string,
    codeHash: string,
    expiresAt: Date
  ): Promise<UserVerificationCode>;
  findLatestByUserId(userId: string): Promise<UserVerificationCode | null>;
  markVerified(id: string, verifiedAt: Date): Promise<void>;
  invalidatePreviousCodes(userId: string, now: Date): Promise<void>;
}

export const USER_QUERY_SERVICE = Symbol('IUserQueryService');

export interface IUserQueryService {
  findById(id: string): Promise<User | null>;
  findByEmailOrUsername(identifier: string): Promise<User | null>;
  findForTokenValidation(id: string): Promise<User | null>;
}

export const CREATE_USER_USE_CASE = Symbol('ICreateUserUseCase');

export interface ICreateUserUseCase {
  execute(dto: CreateUserRequestDto): Promise<void>;
}

export const UPDATE_PROFILE_USE_CASE = Symbol('IUpdateProfileUseCase');

export interface IUpdateProfileUseCase {
  execute(userId: string, dto: UpdateProfileRequestDto): Promise<void>;
}

export const DELETE_ACCOUNT_USE_CASE = Symbol('IDeleteAccountUseCase');

export interface IDeleteAccountUseCase {
  execute(userId: string): Promise<void>;
}

export const ADMIN_USERS_USE_CASE = Symbol('IAdminUsersUseCase');

export interface IAdminUsersUseCase {
  list(cursor?: string, limit?: number): Promise<PaginatedResult<User>>;
  findById(id: string): Promise<User>;
}

export const INITIATE_REGISTRATION_USE_CASE = Symbol(
  'IInitiateRegistrationUseCase'
);

export interface IInitiateRegistrationUseCase {
  execute(dto: CreateUserRequestDto): Promise<void>;
}

export const VERIFY_EMAIL_USE_CASE = Symbol('IVerifyEmailUseCase');

export interface IVerifyEmailUseCase {
  execute(email: string, code: string): Promise<void>;
}

export const RESEND_VERIFICATION_USE_CASE = Symbol(
  'IResendVerificationUseCase'
);

export interface IResendVerificationUseCase {
  execute(email: string): Promise<void>;
}
