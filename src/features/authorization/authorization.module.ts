import { AuthModule } from '@features/auth/auth.module';
import { SessionsModule } from '@features/sessions/sessions.module';
import { UsersModule } from '@features/users/users.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAccountMapper } from './application/mappers/admin-account.mapper';
import { AdminInvitationMapper } from './application/mappers/admin-invitation.mapper';
import { AdminAccountService } from './application/services/admin-account.service';
import { AdminInvitationTokenService } from './application/services/admin-invitation-token.service';
import { PermissionEvaluationService } from './application/services/permission-evaluation.service';
import { AcceptAdminInvitationUseCase } from './application/use-cases/accept-admin-invitation.use-case';
import { AdminDirectoryUseCase } from './application/use-cases/admin-directory.use-case';
import { ChangeAdminStatusUseCase } from './application/use-cases/change-admin-status.use-case';
import { DeleteAdminUseCase } from './application/use-cases/delete-admin.use-case';
import { GrantPermissionsUseCase } from './application/use-cases/grant-permissions.use-case';
import { InviteAdminUseCase } from './application/use-cases/invite-admin.use-case';
import { ListAdminInvitationsUseCase } from './application/use-cases/list-admin-invitations.use-case';
import { ListPermissionsUseCase } from './application/use-cases/list-permissions.use-case';
import { RevokeAdminInvitationUseCase } from './application/use-cases/revoke-admin-invitation.use-case';
import { RevokePermissionsUseCase } from './application/use-cases/revoke-permissions.use-case';
import { UpdateAdminUseCase } from './application/use-cases/update-admin.use-case';
import {
  ACCEPT_ADMIN_INVITATION_USE_CASE,
  ADMIN_DIRECTORY_USE_CASE,
  ADMIN_INVITATION_REPOSITORY,
  ADMIN_PERMISSION_REPOSITORY,
  CHANGE_ADMIN_STATUS_USE_CASE,
  DELETE_ADMIN_USE_CASE,
  GRANT_PERMISSIONS_USE_CASE,
  INVITE_ADMIN_USE_CASE,
  LIST_ADMIN_INVITATIONS_USE_CASE,
  LIST_PERMISSIONS_USE_CASE,
  PERMISSION_CATALOG_REPOSITORY,
  PERMISSION_EVALUATION_SERVICE,
  REVOKE_ADMIN_INVITATION_USE_CASE,
  REVOKE_PERMISSIONS_USE_CASE,
  UPDATE_ADMIN_USE_CASE
} from './application/interfaces/authorization.interface';
import { AdminInvitation } from './domain/entities/admin-invitation.entity';
import { AdminPermission } from './domain/entities/admin-permission.entity';
import { PermissionDefinition } from './domain/entities/permission-definition.entity';
import { AdminInvitationRepository } from './infrastructure/repositories/admin-invitation.repository';
import { AdminPermissionRepository } from './infrastructure/repositories/admin-permission.repository';
import { PermissionCatalogRepository } from './infrastructure/repositories/permission-catalog.repository';
import { AdminAccountsController } from './presentation/controllers/admin-accounts.controller';
import { AdminInvitationsController } from './presentation/controllers/admin-invitations.controller';
import { PermissionsController } from './presentation/controllers/permissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PermissionDefinition,
      AdminPermission,
      AdminInvitation
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
    PermissionsController
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
    AdminAccountMapper,
    AdminInvitationMapper
  ],
  exports: [PERMISSION_EVALUATION_SERVICE, ADMIN_PERMISSION_REPOSITORY]
})
export class AuthorizationModule {}
