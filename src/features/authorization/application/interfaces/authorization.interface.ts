import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import type { EntityManager } from 'typeorm';
import type { PaginatedResult } from '@core/pagination/paginated-result.interface';
import { AdminInvitation } from '../../domain/entities/admin-invitation.entity';
import { AdminPermission } from '../../domain/entities/admin-permission.entity';
import { PermissionDefinition } from '../../domain/entities/permission-definition.entity';
import { Role } from '../../domain/entities/role.entity';
import { Permission } from '../../domain/enums/permission.enum';
import { AcceptAdminInvitationRequestDto } from '../../presentation/dto/request/accept-admin-invitation.request.dto';
import { CreateRoleRequestDto } from '../../presentation/dto/request/create-role.request.dto';
import { InviteAdminRequestDto } from '../../presentation/dto/request/invite-admin.request.dto';
import { PermissionSetRequestDto } from '../../presentation/dto/request/permission-set.request.dto';
import { UpdateAdminRequestDto } from '../../presentation/dto/request/update-admin.request.dto';
import { UpdateRoleRequestDto } from '../../presentation/dto/request/update-role.request.dto';

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
    /** `null` when the granting account has since been deleted. */
    grantedById: string | null,
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
  /**
   * The owner is resolvable only by itself, so that an identifier harvested
   * elsewhere cannot be used to confirm which account is the owner.
   */
  findById(actor: AuthorizationActor, userId: string): Promise<AdminAccount>;
  /** The caller's own administrator profile. */
  findSelf(actor: AuthorizationActor): Promise<AdminAccount>;
}

export const DELETE_ADMIN_USE_CASE = Symbol('IDeleteAdminUseCase');

export interface IDeleteAdminUseCase {
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

export const ADMIN_INVITATION_REPOSITORY = Symbol('IAdminInvitationRepository');

export interface IAdminInvitationRepository {
  create(
    invitation: Partial<AdminInvitation>,
    manager?: EntityManager
  ): Promise<AdminInvitation>;
  findById(id: string): Promise<AdminInvitation | null>;
  findByTokenHash(tokenHash: string): Promise<AdminInvitation | null>;
  findPage(cursorId: string | null, limit: number): Promise<AdminInvitation[]>;
  findPendingByEmail(email: string): Promise<AdminInvitation[]>;
  markRevoked(
    id: string,
    revokedAt: Date,
    manager?: EntityManager
  ): Promise<void>;
  markAccepted(
    id: string,
    acceptedAt: Date,
    acceptedUserId: string,
    manager?: EntityManager
  ): Promise<void>;
}

export const INVITE_ADMIN_USE_CASE = Symbol('IInviteAdminUseCase');

export interface IInviteAdminUseCase {
  execute(
    actorId: string,
    dto: InviteAdminRequestDto
  ): Promise<AdminInvitation>;
}

export const REVOKE_ADMIN_INVITATION_USE_CASE = Symbol(
  'IRevokeAdminInvitationUseCase'
);

export interface IRevokeAdminInvitationUseCase {
  execute(actorId: string, invitationId: string): Promise<void>;
}

export const LIST_ADMIN_INVITATIONS_USE_CASE = Symbol(
  'IListAdminInvitationsUseCase'
);

export interface IListAdminInvitationsUseCase {
  execute(
    cursor?: string,
    limit?: number
  ): Promise<PaginatedResult<AdminInvitation>>;
}

export const ACCEPT_ADMIN_INVITATION_USE_CASE = Symbol(
  'IAcceptAdminInvitationUseCase'
);

export interface IAcceptAdminInvitationUseCase {
  execute(dto: AcceptAdminInvitationRequestDto): Promise<void>;
}

/** A role together with the permissions it grants. */
export interface RoleWithPermissions {
  readonly role: Role;
  readonly permissions: readonly Permission[];
}

export const ROLE_REPOSITORY = Symbol('IRoleRepository');

export interface IRoleRepository {
  findAll(): Promise<Role[]>;
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  create(
    role: Pick<Role, 'name' | 'description'>,
    manager?: EntityManager
  ): Promise<Role>;
  update(
    id: string,
    patch: Partial<Pick<Role, 'name' | 'description'>>
  ): Promise<void>;
  delete(id: string): Promise<void>;
  permissionsOf(roleId: string): Promise<Permission[]>;
  /**
   * Replaces the full permission set of a role in one transaction: whatever
   * is not in `permissions` is removed, whatever is missing is added.
   */
  setPermissions(
    roleId: string,
    permissions: readonly Permission[]
  ): Promise<void>;
}

export const USER_ROLE_REPOSITORY = Symbol('IUserRoleRepository');

export interface IUserRoleRepository {
  rolesForUser(userId: string): Promise<Role[]>;
  /** The union of every permission granted by every role the account holds. */
  permissionsForUser(userId: string): Promise<Permission[]>;
  countAssignments(roleId: string): Promise<number>;
  /** Idempotent: assigning a role an account already holds is a no-op. */
  assign(
    userId: string,
    roleId: string,
    assignedById: string | null
  ): Promise<void>;
  unassign(userId: string, roleId: string): Promise<void>;
}

export const CREATE_ROLE_USE_CASE = Symbol('ICreateRoleUseCase');

export interface ICreateRoleUseCase {
  execute(dto: CreateRoleRequestDto): Promise<Role>;
}

export const UPDATE_ROLE_USE_CASE = Symbol('IUpdateRoleUseCase');

export interface IUpdateRoleUseCase {
  execute(roleId: string, dto: UpdateRoleRequestDto): Promise<void>;
}

export const DELETE_ROLE_USE_CASE = Symbol('IDeleteRoleUseCase');

export interface IDeleteRoleUseCase {
  execute(roleId: string): Promise<void>;
}

export const LIST_ROLES_USE_CASE = Symbol('IListRolesUseCase');

export interface IListRolesUseCase {
  execute(): Promise<RoleWithPermissions[]>;
}

export const GET_ROLE_USE_CASE = Symbol('IGetRoleUseCase');

export interface IGetRoleUseCase {
  execute(roleId: string): Promise<RoleWithPermissions>;
}

export const SET_ROLE_PERMISSIONS_USE_CASE = Symbol(
  'ISetRolePermissionsUseCase'
);

export interface ISetRolePermissionsUseCase {
  execute(
    actor: AuthorizationActor,
    roleId: string,
    dto: PermissionSetRequestDto
  ): Promise<void>;
}

export const ASSIGN_ROLE_USE_CASE = Symbol('IAssignRoleUseCase');

export interface IAssignRoleUseCase {
  execute(
    actor: AuthorizationActor,
    userId: string,
    roleId: string
  ): Promise<void>;
}

export const UNASSIGN_ROLE_USE_CASE = Symbol('IUnassignRoleUseCase');

export interface IUnassignRoleUseCase {
  execute(
    actor: AuthorizationActor,
    userId: string,
    roleId: string
  ): Promise<void>;
}

export const LIST_USER_ROLES_USE_CASE = Symbol('IListUserRolesUseCase');

export interface IListUserRolesUseCase {
  execute(userId: string): Promise<RoleWithPermissions[]>;
}
