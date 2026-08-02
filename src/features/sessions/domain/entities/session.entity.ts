import { User } from '@features/users/domain/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
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

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'timestamp' })
  lastUsedAt!: Date;

  @Column({ default: 0 })
  version!: number;

  @Column({ type: 'timestamp', nullable: true })
  rotatedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.sessions, { nullable: false })
  owner!: User;
}
