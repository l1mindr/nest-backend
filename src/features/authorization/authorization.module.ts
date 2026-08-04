import { SessionsModule } from '@features/sessions/sessions.module';
import { UsersModule } from '@features/users/users.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAccountMapper } from './application/mappers/admin-account.mapper';
import { AdminAccountService } from './application/services/admin-account.service';
import { PermissionEvaluationService } from './application/services/permission-evaluation.service';
import { AdminDirectoryUseCase } from './application/use-cases/admin-directory.use-case';
import { ChangeAdminStatusUseCase } from './application/use-cases/change-admin-status.use-case';
import { GrantAdminRoleUseCase } from './application/use-cases/grant-admin-role.use-case';
import { GrantPermissionsUseCase } from './application/use-cases/grant-permissions.use-case';
import { ListPermissionsUseCase } from './application/use-cases/list-permissions.use-case';
import { RevokeAdminRoleUseCase } from './application/use-cases/revoke-admin-role.use-case';
import { RevokePermissionsUseCase } from './application/use-cases/revoke-permissions.use-case';
import { UpdateAdminUseCase } from './application/use-cases/update-admin.use-case';
import {
  ADMIN_DIRECTORY_USE_CASE,
  ADMIN_PERMISSION_REPOSITORY,
  CHANGE_ADMIN_STATUS_USE_CASE,
  GRANT_ADMIN_ROLE_USE_CASE,
  GRANT_PERMISSIONS_USE_CASE,
  LIST_PERMISSIONS_USE_CASE,
  PERMISSION_CATALOG_REPOSITORY,
  PERMISSION_EVALUATION_SERVICE,
  REVOKE_ADMIN_ROLE_USE_CASE,
  REVOKE_PERMISSIONS_USE_CASE,
  UPDATE_ADMIN_USE_CASE
} from './application/interfaces/authorization.interface';
import { AdminPermission } from './domain/entities/admin-permission.entity';
import { PermissionDefinition } from './domain/entities/permission-definition.entity';
import { AdminPermissionRepository } from './infrastructure/repositories/admin-permission.repository';
import { PermissionCatalogRepository } from './infrastructure/repositories/permission-catalog.repository';
import { AdminAccountsController } from './presentation/controllers/admin-accounts.controller';
import { PermissionsController } from './presentation/controllers/permissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionDefinition, AdminPermission]),
    // Administrators are user accounts, so role and status changes go through
    // the user repository rather than a second store, and suspension reuses the
    // use cases the users module already owns.
    UsersModule,
    SessionsModule
  ],
  controllers: [AdminAccountsController, PermissionsController],
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
    PermissionEvaluationService,
    {
      provide: PERMISSION_EVALUATION_SERVICE,
      useExisting: PermissionEvaluationService
    },
    AdminAccountService,
    AdminDirectoryUseCase,
    { provide: ADMIN_DIRECTORY_USE_CASE, useExisting: AdminDirectoryUseCase },
    GrantAdminRoleUseCase,
    { provide: GRANT_ADMIN_ROLE_USE_CASE, useExisting: GrantAdminRoleUseCase },
    RevokeAdminRoleUseCase,
    {
      provide: REVOKE_ADMIN_ROLE_USE_CASE,
      useExisting: RevokeAdminRoleUseCase
    },
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
    AdminAccountMapper
  ],
  exports: [PERMISSION_EVALUATION_SERVICE, ADMIN_PERMISSION_REPOSITORY]
})
export class AuthorizationModule {}
