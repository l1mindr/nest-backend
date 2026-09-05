import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../../domain/entities/role.entity';
import { RolePermission } from '../../domain/entities/role-permission.entity';
import { UserRoleAssignment } from '../../domain/entities/user-role-assignment.entity';
import { Permission } from '../../domain/enums/permission.enum';
import { IUserRoleRepository } from '../../application/interfaces/authorization.interface';

@Injectable()
export class UserRoleRepository implements IUserRoleRepository {
  private get assignmentRepo(): Repository<UserRoleAssignment> {
    return this.dataSource.getRepository(UserRoleAssignment);
  }

  constructor(private readonly dataSource: DataSource) {}

  async rolesForUser(userId: string): Promise<Role[]> {
    return this.dataSource
      .getRepository(Role)
      .createQueryBuilder('role')
      .innerJoin(
        UserRoleAssignment,
        'assignment',
        '"assignment"."roleId" = "role"."id"'
      )
      .where('"assignment"."userId" = :userId', { userId })
      .orderBy('role.name', 'ASC')
      .getMany();
  }

  /**
   * The union of every permission granted by every role the account holds,
   * deduplicated by the query itself rather than in application code.
   */
  async permissionsForUser(userId: string): Promise<Permission[]> {
    const rows = await this.dataSource
      .getRepository(RolePermission)
      .createQueryBuilder('rolePermission')
      .innerJoin(
        UserRoleAssignment,
        'assignment',
        '"assignment"."roleId" = "rolePermission"."roleId"'
      )
      .where('"assignment"."userId" = :userId', { userId })
      .distinct(true)
      .select('rolePermission.permission', 'permission')
      .getRawMany<{ permission: Permission }>();

    return rows.map((row) => row.permission);
  }

  async countAssignments(roleId: string): Promise<number> {
    return this.assignmentRepo.count({ where: { roleId } });
  }

  /**
   * Idempotent: an account already assigned a role is left untouched rather
   * than raising a unique-violation, so a replayed request is not an error.
   */
  async assign(
    userId: string,
    roleId: string,
    assignedById: string | null
  ): Promise<void> {
    await this.assignmentRepo
      .createQueryBuilder()
      .insert()
      .into(UserRoleAssignment)
      .values({ userId, roleId, assignedById })
      .orIgnore()
      .execute();
  }

  async unassign(userId: string, roleId: string): Promise<void> {
    await this.assignmentRepo.delete({ userId, roleId });
  }
}
