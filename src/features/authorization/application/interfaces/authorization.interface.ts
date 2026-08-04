import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import type { EntityManager } from 'typeorm';
import type { PaginatedResult } from '@core/pagination/paginated-result.interface';
import { AdminPermission } from '../../domain/entities/admin-permission.entity';
import { PermissionDefinition } from '../../domain/entities/permission-definition.entity';
import { Permission } from '../../domain/enums/permission.enum';
import { CreateAdminRequestDto } from '../../presentation/dto/request/create-admin.request.dto';
import { PermissionSetRequestDto } from '../../presentation/dto/request/permission-set.request.dto';
import { UpdateAdminRequestDto } from '../../presentation/dto/request/update-admin.request.dto';

export type { PaginatedResult } from '@core/pagination/paginated-result.interface';

/**
 * Who is making the request. Structurally identical to the `AuthUser` the JWT
 * guard puts on the request, so it can be handed straight through, but declared
 * here so the application layer does not reach into presentation for its own
 * vocabulary.
 */
export interface AuthorizationActor {
  readonly id: string;
  readonly role: UserRole;
}

/** An administrator together with the permissions they hold. */
export interface AdminAccount {
  readonly account: User;
  readonly permissions: readonly Permission[];
}

export const PERMISSION_CATALOG_REPOSITORY = Symbol(
  'IPermissionCatalogRepository'
);

export interface IPermissionCatalogRepository {
  findAll(): Promise<PermissionDefinition[]>;
}

export const ADMIN_PERMISSION_REPOSITORY = Symbol('IAdminPermissionRepository');

export interface IAdminPermissionRepository {
  findByUserId(userId: string): Promise<Permission[]>;
  /** Batched to keep the administrator directory off an N+1 query. */
  findByUserIds(userIds: readonly string[]): Promise<Map<string, Permission[]>>;
  findGrants(userId: string): Promise<AdminPermission[]>;
  grant(
    userId: string,
    permissions: readonly Permission[],
    grantedById: string,
    manager?: EntityManager
  ): Promise<void>;
  revoke(
    userId: string,
    permissions: readonly Permission[],
    manager?: EntityManager
  ): Promise<void>;
  revokeAll(userId: string, manager?: EntityManager): Promise<void>;
}

export const PERMISSION_EVALUATION_SERVICE = Symbol(
  'IPermissionEvaluationService'
);

/**
 * The only component that decides whether a caller may do something. Guards ask
 * it, use cases ask it; neither reimplements the rule.
 */
export interface IPermissionEvaluationService {
  can(
    actor: AuthorizationActor,
    required: readonly Permission[]
  ): Promise<boolean>;
  assertCan(
    actor: AuthorizationActor,
    required: readonly Permission[]
  ): Promise<void>;
  effectivePermissionsOf(actor: AuthorizationActor): Promise<Permission[]>;
  assertCanDelegate(
    actor: AuthorizationActor,
    permissions: readonly Permission[]
  ): Promise<void>;
}

export const ADMIN_DIRECTORY_USE_CASE = Symbol('IAdminDirectoryUseCase');

export interface IAdminDirectoryUseCase {
  list(cursor?: string, limit?: number): Promise<PaginatedResult<AdminAccount>>;
  findById(userId: string): Promise<AdminAccount>;
}

export const GRANT_ADMIN_ROLE_USE_CASE = Symbol('IGrantAdminRoleUseCase');

export interface IGrantAdminRoleUseCase {
  execute(actorId: string, dto: CreateAdminRequestDto): Promise<AdminAccount>;
}

export const REVOKE_ADMIN_ROLE_USE_CASE = Symbol('IRevokeAdminRoleUseCase');

export interface IRevokeAdminRoleUseCase {
  execute(actorId: string, targetId: string): Promise<void>;
}

export const CHANGE_ADMIN_STATUS_USE_CASE = Symbol('IChangeAdminStatusUseCase');

export interface IChangeAdminStatusUseCase {
  activate(actorId: string, targetId: string): Promise<void>;
  deactivate(actorId: string, targetId: string): Promise<void>;
}

export const UPDATE_ADMIN_USE_CASE = Symbol('IUpdateAdminUseCase');

export interface IUpdateAdminUseCase {
  execute(
    actorId: string,
    targetId: string,
    dto: UpdateAdminRequestDto
  ): Promise<void>;
}

export const GRANT_PERMISSIONS_USE_CASE = Symbol('IGrantPermissionsUseCase');

export interface IGrantPermissionsUseCase {
  execute(
    actor: AuthorizationActor,
    targetId: string,
    dto: PermissionSetRequestDto
  ): Promise<void>;
}

export const REVOKE_PERMISSIONS_USE_CASE = Symbol('IRevokePermissionsUseCase');

export interface IRevokePermissionsUseCase {
  execute(
    actor: AuthorizationActor,
    targetId: string,
    dto: PermissionSetRequestDto
  ): Promise<void>;
}

export const LIST_PERMISSIONS_USE_CASE = Symbol('IListPermissionsUseCase');

export interface IListPermissionsUseCase {
  execute(): Promise<PermissionDefinition[]>;
}
