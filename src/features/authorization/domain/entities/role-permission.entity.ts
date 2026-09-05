import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique
} from 'typeorm';
import { Permission } from '../enums/permission.enum';
import { PermissionDefinition } from './permission-definition.entity';
import { Role } from './role.entity';

/**
 * One permission granted by one role.
 *
 * FK'd to the catalog rather than a free string, for the same reason
 * `admin_permission` is: a grant, whether direct or through a role, can only
 * ever name a permission the system knows about.
 */
@Entity('role_permission')
@Unique('role_permission_unique', ['roleId', 'permission'])
@Index('IDX_role_permission_role_id', ['roleId'])
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  roleId!: string;

  @Column({ type: 'varchar', length: 64 })
  permission!: Permission;

  @ManyToOne(() => Role, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @ManyToOne(() => PermissionDefinition, {
    nullable: false,
    onDelete: 'RESTRICT'
  })
  @JoinColumn({ name: 'permission', referencedColumnName: 'code' })
  definition!: PermissionDefinition;
}
