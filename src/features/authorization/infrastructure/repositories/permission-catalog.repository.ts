import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PermissionDefinition } from '../../domain/entities/permission-definition.entity';
import { IPermissionCatalogRepository } from '../../application/interfaces/authorization.interface';

@Injectable()
export class PermissionCatalogRepository implements IPermissionCatalogRepository {
  private get catalogRepo(): Repository<PermissionDefinition> {
    return this.dataSource.getRepository(PermissionDefinition);
  }

  constructor(private readonly dataSource: DataSource) {}

  async findAll(): Promise<PermissionDefinition[]> {
    return this.catalogRepo.find({ order: { code: 'ASC' } });
  }
}
