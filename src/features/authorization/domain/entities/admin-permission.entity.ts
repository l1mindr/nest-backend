import { User } from '@features/users/domain/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique
} from 'typeorm';
import { Permission } from '../enums/permission.enum';
import { PermissionDefinition } from './permission-definition.entity';

/**
 * One permission granted to one administrator.
 *
 * Grants live on the account rather than on a named role so that an
 * administrator can hold any subset — "support", "moderator" and "read-only"
 * are descriptions of a grant set, not types in the schema. Naming those sets
 * later means adding a role-to-permission table and one branch in the
 * evaluation service; nothing on the request path or in any controller changes.
 *
 * `permission` is a foreign key into the catalog rather than a free string, and
 * `grantedBy` is retained so a privilege can always be traced back to whoever
 * handed it out.
 */
@Entity('admin_permission')
@Unique('admin_permission_unique', ['userId', 'permission'])
@Index('IDX_admin_permission_user_id', ['userId'])
export class AdminPermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  permission!: Permission;

  /** `null` once the granting account has been removed. */
  @Column({ type: 'uuid', nullable: true })
  grantedById!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  grantedAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  administrator!: User;

  @ManyToOne(() => PermissionDefinition, {
    nullable: false,
    onDelete: 'RESTRICT'
  })
  @JoinColumn({ name: 'permission', referencedColumnName: 'code' })
  definition!: PermissionDefinition;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grantedById' })
  grantedBy!: User | null;
}
