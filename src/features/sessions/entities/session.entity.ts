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
import { IUserAgent } from '../interfaces/user-agent.interface';
import { SwaggerSessionPropertiesUpdate as SessionProps } from '../sessions.swagger';

@Entity()
export class Session {
  @ApiProperty(SessionProps.id)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty(SessionProps.refreshTokenHash)
  @Column()
  refreshTokenHash: string;

  @ApiProperty(SessionProps.userAgent)
  @Column({ type: 'json' })
  userAgent: IUserAgent;

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
