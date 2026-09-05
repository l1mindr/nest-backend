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
import { Role } from './role.entity';

/**
 * One role assigned to one account.
 *
 * Named `UserRoleAssignment` rather than `UserRole` because that name is
 * already the tier enum on `User` (`OWNER | ADMIN | USER`). The two are
 * unrelated: the tier is a fixed column, this is a many-to-many join to a
 * data-driven role catalog, and neither replaces the other.
 *
 * The role is `RESTRICT`ed rather than cascaded so a role with active
 * assignments cannot be deleted out from under them by a database-level
 * cascade — the same protection `AssignRoleUseCase`/`DeleteRoleUseCase`
 * already enforce at the application layer.
 */
@Entity('user_role_assignment')
@Unique('user_role_assignment_unique', ['userId', 'roleId'])
@Index('IDX_user_role_assignment_user_id', ['userId'])
export class UserRoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  roleId!: string;

  /** `null` once the assigning account has been removed. */
  @Column({ type: 'uuid', nullable: true })
  assignedById!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  assignedAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  account!: User;

  @ManyToOne(() => Role, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedById' })
  assignedBy!: User | null;
}
