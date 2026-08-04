import { UserRole } from '@features/users/domain/enums/user-role.enum';
import type { EntityManager } from 'typeorm';
import { AdminPermission } from '../../domain/entities/admin-permission.entity';
import { PermissionDefinition } from '../../domain/entities/permission-definition.entity';
import { Permission } from '../../domain/enums/permission.enum';

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
}
