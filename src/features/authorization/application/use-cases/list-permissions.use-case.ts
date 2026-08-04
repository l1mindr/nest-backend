import { Inject, Injectable } from '@nestjs/common';
import { PermissionDefinition } from '../../domain/entities/permission-definition.entity';
import {
  IListPermissionsUseCase,
  IPermissionCatalogRepository,
  PERMISSION_CATALOG_REPOSITORY
} from '../interfaces/authorization.interface';

/**
 * The permission catalog, read from the table rather than from the enum so that
 * a permission introduced by migration is visible to operators without a
 * redeploy.
 */
@Injectable()
export class ListPermissionsUseCase implements IListPermissionsUseCase {
  constructor(
    @Inject(PERMISSION_CATALOG_REPOSITORY)
    private readonly permissionCatalogRepository: IPermissionCatalogRepository
  ) {}

  async execute(): Promise<PermissionDefinition[]> {
    return this.permissionCatalogRepository.findAll();
  }
}
