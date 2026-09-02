import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';

/**
 * A named bundle of permissions that can be assigned to more than one account
 * at once.
 *
 * This sits alongside `admin_permission`, not in place of it: a direct grant
 * still works exactly as before, and a role is a second, additive source of
 * permissions layered on top. Nothing that already worked can be taken away by
 * a role — at worst a role is misconfigured and grants nothing.
 *
 * `OWNER`, `ADMIN` and `USER` are seeded as system roles (`isSystem: true`).
 * They exist as catalog entries mirroring the account tiers already enforced
 * by `user.role`; they carry no permissions of their own, since the tiers work
 * without one. System roles cannot be renamed, have their permissions edited,
 * or be deleted — only custom roles can.
 */
@Entity('role')
@Unique('role_name_unique', ['name'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'boolean', default: false })
  isSystem!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
