import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEvaluationService } from './application/services/permission-evaluation.service';
import {
  ADMIN_PERMISSION_REPOSITORY,
  PERMISSION_CATALOG_REPOSITORY,
  PERMISSION_EVALUATION_SERVICE
} from './application/interfaces/authorization.interface';
import { AdminPermission } from './domain/entities/admin-permission.entity';
import { PermissionDefinition } from './domain/entities/permission-definition.entity';
import { AdminPermissionRepository } from './infrastructure/repositories/admin-permission.repository';
import { PermissionCatalogRepository } from './infrastructure/repositories/permission-catalog.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionDefinition, AdminPermission])],
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
    }
  ],
  exports: [PERMISSION_EVALUATION_SERVICE, ADMIN_PERMISSION_REPOSITORY]
})
export class AuthorizationModule {}
