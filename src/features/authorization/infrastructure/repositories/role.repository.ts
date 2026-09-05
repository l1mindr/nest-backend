import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Role } from '../../domain/entities/role.entity';
import { RolePermission } from '../../domain/entities/role-permission.entity';
import { Permission } from '../../domain/enums/permission.enum';
import { IRoleRepository } from '../../application/interfaces/authorization.interface';

@Injectable()
export class RoleRepository implements IRoleRepository {
  private get roleRepo(): Repository<Role> {
    return this.dataSource.getRepository(Role);
  }

  private get rolePermissionRepo(): Repository<RolePermission> {
    return this.dataSource.getRepository(RolePermission);
  }

  constructor(private readonly dataSource: DataSource) {}

  private repoFor(manager?: EntityManager): Repository<Role> {
    return manager?.getRepository(Role) ?? this.roleRepo;
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { name } });
  }

  async create(
    role: Pick<Role, 'name' | 'description'>,
    manager?: EntityManager
  ): Promise<Role> {
    const repository = this.repoFor(manager);

    return repository.save(repository.create(role));
  }

  async update(
    id: string,
    patch: Partial<Pick<Role, 'name' | 'description'>>
  ): Promise<void> {
    await this.roleRepo.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    await this.roleRepo.delete({ id });
  }

  async permissionsOf(roleId: string): Promise<Permission[]> {
    const rows = await this.rolePermissionRepo.find({
      where: { roleId },
      select: { permission: true }
    });

    return rows.map((row) => row.permission);
  }

  /**
   * Replaces the full set inside a transaction so a partial write can never
   * leave the role holding a mix of the old and new set.
   */
  async setPermissions(
    roleId: string,
    permissions: readonly Permission[]
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RolePermission);

      await repo.delete({ roleId });

      if (permissions.length === 0) return;

      await repo
        .createQueryBuilder()
        .insert()
        .into(RolePermission)
        .values(permissions.map((permission) => ({ roleId, permission })))
        .orIgnore()
        .execute();
    });
  }
}
