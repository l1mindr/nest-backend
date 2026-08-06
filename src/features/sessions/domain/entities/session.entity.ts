import { User } from '@features/users/domain/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { ISessionDevice } from '../../application/interfaces/session-device.interface';

/**
 * Persistence model. Never serialized to clients directly — the sessions
 * endpoints project it through `SessionResponseDto`, which is what keeps
 * `refreshTokenHash` out of the API surface and out of the OpenAPI schema.
 */
@Entity()
@Index('IDX_session_owner_active', ['owner', 'isRevoked', 'expiresAt'])
@Index('IDX_session_owner_created', [
  'owner',
  'isRevoked',
  'expiresAt',
  'createdAt'
])
@Index('IDX_session_expires_at', ['expiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  refreshTokenHash!: string;

  @Column({ type: 'jsonb' })
  device!: ISessionDevice;

  @Column()
  ipAddress!: string;

  @Column({ default: false })
  isRevoked!: boolean;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz' })
  lastUsedAt!: Date;

  @Column({ default: 0 })
  version!: number;

  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.sessions, { nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column({ name: 'ownerId', type: 'uuid' })
  ownerId!: string;
}
