import { AuthModule } from '@features/auth/auth.module';
import { SessionsModule } from '@features/sessions/sessions.module';
import { UsersModule } from '@features/users/users.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAccountMapper } from './application/mappers/admin-account.mapper';
import { AdminInvitationMapper } from './application/mappers/admin-invitation.mapper';
import { RoleMapper } from './application/mappers/role.mapper';
import { AdminAccountService } from './application/services/admin-account.service';
import { AdminInvitationTokenService } from './application/services/admin-invitation-token.service';
import { PermissionEvaluationService } from './application/services/permission-evaluation.service';
import { AcceptAdminInvitationUseCase } from './application/use-cases/accept-admin-invitation.use-case';
import { AdminDirectoryUseCase } from './application/use-cases/admin-directory.use-case';
import { AssignRoleUseCase } from './application/use-cases/assign-role.use-case';
import { ChangeAdminStatusUseCase } from './application/use-cases/change-admin-status.use-case';
import { CreateRoleUseCase } from './application/use-cases/create-role.use-case';
import { DeleteAdminUseCase } from './application/use-cases/delete-admin.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role.use-case';
import { GetRoleUseCase } from './application/use-cases/get-role.use-case';
import { GrantPermissionsUseCase } from './application/use-cases/grant-permissions.use-case';
import { InviteAdminUseCase } from './application/use-cases/invite-admin.use-case';
import { ListAdminInvitationsUseCase } from './application/use-cases/list-admin-invitations.use-case';
import { ListPermissionsUseCase } from './application/use-cases/list-permissions.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles.use-case';
import { ListUserRolesUseCase } from './application/use-cases/list-user-roles.use-case';
import { RevokeAdminInvitationUseCase } from './application/use-cases/revoke-admin-invitation.use-case';
import { RevokePermissionsUseCase } from './application/use-cases/revoke-permissions.use-case';
import { SetRolePermissionsUseCase } from './application/use-cases/set-role-permissions.use-case';
import { UnassignRoleUseCase } from './application/use-cases/unassign-role.use-case';
import { UpdateAdminUseCase } from './application/use-cases/update-admin.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role.use-case';
import {
  ACCEPT_ADMIN_INVITATION_USE_CASE,
  ADMIN_DIRECTORY_USE_CASE,
  ADMIN_INVITATION_REPOSITORY,
  ADMIN_PERMISSION_REPOSITORY,
  ASSIGN_ROLE_USE_CASE,
  CHANGE_ADMIN_STATUS_USE_CASE,
  CREATE_ROLE_USE_CASE,
  DELETE_ADMIN_USE_CASE,
  DELETE_ROLE_USE_CASE,
  GET_ROLE_USE_CASE,
  GRANT_PERMISSIONS_USE_CASE,
  INVITE_ADMIN_USE_CASE,
  LIST_ADMIN_INVITATIONS_USE_CASE,
  LIST_PERMISSIONS_USE_CASE,
  LIST_ROLES_USE_CASE,
  LIST_USER_ROLES_USE_CASE,
  PERMISSION_CATALOG_REPOSITORY,
  PERMISSION_EVALUATION_SERVICE,
  REVOKE_ADMIN_INVITATION_USE_CASE,
  REVOKE_PERMISSIONS_USE_CASE,
  ROLE_REPOSITORY,
  SET_ROLE_PERMISSIONS_USE_CASE,
  UNASSIGN_ROLE_USE_CASE,
  UPDATE_ADMIN_USE_CASE,
  UPDATE_ROLE_USE_CASE,
  USER_ROLE_REPOSITORY
} from './application/interfaces/authorization.interface';
import { AdminInvitation } from './domain/entities/admin-invitation.entity';
import { AdminPermission } from './domain/entities/admin-permission.entity';
import { PermissionDefinition } from './domain/entities/permission-definition.entity';
import { Role } from './domain/entities/role.entity';
import { RolePermission } from './domain/entities/role-permission.entity';
import { UserRoleAssignment } from './domain/entities/user-role-assignment.entity';
import { AdminInvitationRepository } from './infrastructure/repositories/admin-invitation.repository';
import { AdminPermissionRepository } from './infrastructure/repositories/admin-permission.repository';
import { PermissionCatalogRepository } from './infrastructure/repositories/permission-catalog.repository';
import { RoleRepository } from './infrastructure/repositories/role.repository';
import { UserRoleRepository } from './infrastructure/repositories/user-role.repository';
import { AdminAccountsController } from './presentation/controllers/admin-accounts.controller';
import { AdminInvitationsController } from './presentation/controllers/admin-invitations.controller';
import { PermissionsController } from './presentation/controllers/permissions.controller';
import { RolesController } from './presentation/controllers/roles.controller';
import { UserRolesController } from './presentation/controllers/user-roles.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PermissionDefinition,
      AdminPermission,
      AdminInvitation,
      Role,
      RolePermission,
      UserRoleAssignment
    ]),
    // Administrators are user accounts, so status changes go through the user
    // repository rather than a second store, and suspension reuses the use
    // cases the users module already owns.
    UsersModule,
    SessionsModule,
    // Acceptance hashes the password the invitee chooses, using the same
    // provider the registration path uses rather than a second one.
    AuthModule
  ],
  // `AdminInvitationsController` is registered first so that `/invitations` is
  // matched as a literal segment rather than by the `:id` route of
  // `AdminAccountsController`, which shares its path prefix.
  controllers: [
    AdminInvitationsController,
    AdminAccountsController,
    PermissionsController,
    RolesController,
    UserRolesController
  ],
  providers: [
    PermissionCatalogRepository,
    {
      provide: PERMISSION_CATALOG_REPOSITORY,
      useExisting: PermissionCatalogRepository
    },
    AdminPermissionRepository,
    {
      provide: ADMIN_PERMISSION_REPOSITORY,
      useExisting: AdminPermissionRepository
    },
    AdminInvitationRepository,
    {
      provide: ADMIN_INVITATION_REPOSITORY,
      useExisting: AdminInvitationRepository
    },
    RoleRepository,
    { provide: ROLE_REPOSITORY, useExisting: RoleRepository },
    UserRoleRepository,
    { provide: USER_ROLE_REPOSITORY, useExisting: UserRoleRepository },
    PermissionEvaluationService,
    {
      provide: PERMISSION_EVALUATION_SERVICE,
      useExisting: PermissionEvaluationService
    },
    AdminInvitationTokenService,
    AdminAccountService,
    AdminDirectoryUseCase,
    { provide: ADMIN_DIRECTORY_USE_CASE, useExisting: AdminDirectoryUseCase },
    InviteAdminUseCase,
    { provide: INVITE_ADMIN_USE_CASE, useExisting: InviteAdminUseCase },
    ListAdminInvitationsUseCase,
    {
      provide: LIST_ADMIN_INVITATIONS_USE_CASE,
      useExisting: ListAdminInvitationsUseCase
    },
    RevokeAdminInvitationUseCase,
    {
      provide: REVOKE_ADMIN_INVITATION_USE_CASE,
      useExisting: RevokeAdminInvitationUseCase
    },
    AcceptAdminInvitationUseCase,
    {
      provide: ACCEPT_ADMIN_INVITATION_USE_CASE,
      useExisting: AcceptAdminInvitationUseCase
    },
    DeleteAdminUseCase,
    { provide: DELETE_ADMIN_USE_CASE, useExisting: DeleteAdminUseCase },
    ChangeAdminStatusUseCase,
    {
      provide: CHANGE_ADMIN_STATUS_USE_CASE,
      useExisting: ChangeAdminStatusUseCase
    },
    UpdateAdminUseCase,
    { provide: UPDATE_ADMIN_USE_CASE, useExisting: UpdateAdminUseCase },
    GrantPermissionsUseCase,
    {
      provide: GRANT_PERMISSIONS_USE_CASE,
      useExisting: GrantPermissionsUseCase
    },
    RevokePermissionsUseCase,
    {
      provide: REVOKE_PERMISSIONS_USE_CASE,
      useExisting: RevokePermissionsUseCase
    },
    ListPermissionsUseCase,
    { provide: LIST_PERMISSIONS_USE_CASE, useExisting: ListPermissionsUseCase },
    CreateRoleUseCase,
    { provide: CREATE_ROLE_USE_CASE, useExisting: CreateRoleUseCase },
    UpdateRoleUseCase,
    { provide: UPDATE_ROLE_USE_CASE, useExisting: UpdateRoleUseCase },
    DeleteRoleUseCase,
    { provide: DELETE_ROLE_USE_CASE, useExisting: DeleteRoleUseCase },
    ListRolesUseCase,
    { provide: LIST_ROLES_USE_CASE, useExisting: ListRolesUseCase },
    GetRoleUseCase,
    { provide: GET_ROLE_USE_CASE, useExisting: GetRoleUseCase },
    SetRolePermissionsUseCase,
    {
      provide: SET_ROLE_PERMISSIONS_USE_CASE,
      useExisting: SetRolePermissionsUseCase
    },
    AssignRoleUseCase,
    { provide: ASSIGN_ROLE_USE_CASE, useExisting: AssignRoleUseCase },
    UnassignRoleUseCase,
    { provide: UNASSIGN_ROLE_USE_CASE, useExisting: UnassignRoleUseCase },
    ListUserRolesUseCase,
    {
      provide: LIST_USER_ROLES_USE_CASE,
      useExisting: ListUserRolesUseCase
    },
    AdminAccountMapper,
    AdminInvitationMapper,
    RoleMapper
  ],
  exports: [PERMISSION_EVALUATION_SERVICE, ADMIN_PERMISSION_REPOSITORY]
})
export class AuthorizationModule {}
