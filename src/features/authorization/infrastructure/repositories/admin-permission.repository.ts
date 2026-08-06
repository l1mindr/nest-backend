import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AdminPermission } from '../../domain/entities/admin-permission.entity';
import { Permission } from '../../domain/enums/permission.enum';
import { IAdminPermissionRepository } from '../../application/interfaces/authorization.interface';

@Injectable()
export class AdminPermissionRepository implements IAdminPermissionRepository {
  private get grantRepo(): Repository<AdminPermission> {
    return this.dataSource.getRepository(AdminPermission);
  }

  constructor(private readonly dataSource: DataSource) {}

  private repoFor(manager?: EntityManager): Repository<AdminPermission> {
    return manager?.getRepository(AdminPermission) ?? this.grantRepo;
  }

  async findByUserId(userId: string): Promise<Permission[]> {
    const rows = await this.grantRepo.find({
      where: { userId },
      select: { permission: true }
    });

    return rows.map((row) => row.permission);
  }

  async findByUserIds(
    userIds: readonly string[]
  ): Promise<Map<string, Permission[]>> {
    const grouped = new Map<string, Permission[]>();

    if (userIds.length === 0) return grouped;

    const rows = await this.grantRepo.find({
      where: { userId: In([...userIds]) },
      select: { userId: true, permission: true }
    });

    for (const row of rows) {
      const held = grouped.get(row.userId);

      if (held) {
        held.push(row.permission);
      } else {
        grouped.set(row.userId, [row.permission]);
      }
    }

    return grouped;
  }

  async findGrants(userId: string): Promise<AdminPermission[]> {
    return this.grantRepo.find({
      where: { userId },
      order: { permission: 'ASC' }
    });
  }

  /**
   * Idempotent: re-granting a permission an administrator already holds is a
   * no-op rather than a unique-violation, so a caller replaying a request does
   * not get an error for a state that is already correct.
   */
  async grant(
    userId: string,
    permissions: readonly Permission[],
    grantedById: string | null,
    manager?: EntityManager
  ): Promise<void> {
    if (permissions.length === 0) return;

    await this.repoFor(manager)
      .createQueryBuilder()
      .insert()
      .into(AdminPermission)
      .values(
        permissions.map((permission) => ({ userId, permission, grantedById }))
      )
      .orIgnore()
      .execute();
  }

  async revoke(
    userId: string,
    permissions: readonly Permission[],
    manager?: EntityManager
  ): Promise<void> {
    if (permissions.length === 0) return;

    await this.repoFor(manager).delete({
      userId,
      permission: In([...permissions])
    });
  }

  async revokeAll(userId: string, manager?: EntityManager): Promise<void> {
    await this.repoFor(manager).delete({ userId });
  }
}
