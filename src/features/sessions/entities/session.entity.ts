import { User } from '@features/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { SwaggerSessionProperties as SessionProps } from '../sessions.swagger';
import { ISessionDevice } from '../interfaces/session-device.interface';

@Entity()
export class Session {
  @ApiProperty(SessionProps.id)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty(SessionProps.refreshTokenHash)
  @Column()
  refreshTokenHash: string;

  @ApiProperty(SessionProps.userAgent)
  @Column({ type: 'jsonb' })
  device: ISessionDevice;

  @ApiProperty(SessionProps.ipAddress)
  @Column()
  ipAddress: string;

  @Column({ default: false })
  isRevoked: boolean;

  @ApiProperty(SessionProps.expireAt)
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @ApiProperty(SessionProps.lastUsedAt)
  @Column({ type: 'timestamp' })
  lastUsedAt: Date;

  @ApiProperty(SessionProps.createdAt)
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty(SessionProps.updatedAt)
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty(SessionProps.user)
  @ManyToOne(() => User, (user) => user.sessions, { nullable: false })
  owner: User;
}
