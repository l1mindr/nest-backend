import { User } from '@features/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { ISessionDevice } from '../interfaces/session-device.interface';
import { SwaggerSessionProperties as SessionProps } from '../sessions.swagger';

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
  @ApiProperty(SessionProps.id)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty(SessionProps.refreshTokenHash)
  @Column()
  refreshTokenHash!: string;

  @ApiProperty(SessionProps.userAgent)
  @Column({ type: 'jsonb' })
  device!: ISessionDevice;

  @ApiProperty(SessionProps.ipAddress)
  @Column()
  ipAddress!: string;

  @Column({ default: false })
  isRevoked!: boolean;

  @ApiProperty(SessionProps.expireAt)
  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @ApiProperty(SessionProps.lastUsedAt)
  @Column({ type: 'timestamp' })
  lastUsedAt!: Date;

  @Column({ default: 0 })
  version!: number;

  @Column({ type: 'timestamp', nullable: true })
  rotatedAt!: Date;

  @ApiProperty(SessionProps.createdAt)
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty(SessionProps.updatedAt)
  @UpdateDateColumn()
  updatedAt!: Date;

  @ApiProperty(SessionProps.user)
  @ManyToOne(() => User, (user) => user.sessions, { nullable: false })
  owner!: User;
}
