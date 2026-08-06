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

/**
 * A pending offer of administrator status.
 *
 * Nothing about this row is an account: the administrator is created only when
 * the invitation is accepted, so a revoked or expired invitation leaves no
 * dormant privileged account behind.
 *
 * Only the digest of the token is stored. A database dump therefore yields
 * nothing an attacker can present — the token exists in the invitee's mailbox
 * and nowhere else on the server.
 */
@Entity('admin_invitation')
@Unique('admin_invitation_token_unique', ['tokenHash'])
@Index('IDX_admin_invitation_email', ['email'])
export class AdminInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  email!: string;

  /**
   * SHA-256 of the issued token, hex encoded. A plain digest is enough here
   * where it would not be for a password: the token carries 256 bits of
   * entropy, so there is no dictionary to run against it.
   */
  @Column({ type: 'varchar', length: 64, select: false })
  tokenHash!: string;

  /**
   * The permissions the account will receive on acceptance. Held as codes
   * rather than as `admin_permission` rows, because until the invitation is
   * accepted there is no account for those rows to point at. The real grants,
   * with their foreign key to the catalog, are written at acceptance.
   */
  @Column({ type: 'varchar', length: 64, array: true, default: () => "'{}'" })
  permissions!: Permission[];

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  /** Retained for the audit trail; survives the inviter being deleted. */
  @Column({ type: 'uuid', nullable: true })
  invitedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invitedById' })
  invitedBy!: User | null;

  @Column({ type: 'uuid', nullable: true })
  acceptedUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'acceptedUserId' })
  acceptedUser!: User | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
