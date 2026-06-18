import { Session } from '@features/sessions/entities/session.entity';
import { RegistryDatesOrm } from '@infrastructure/databases/postgres/embedded/registry-dates.embedded';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { SwaggerUserProperties as UserProps } from '../users.swagger';

@Entity()
@Unique('users_email_unique', ['email'])
@Unique('users_username_unique', ['username'])
export class User {
  @ApiProperty(UserProps.id)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional(UserProps.name)
  @Column({ length: 50, nullable: true, select: false })
  name: string;

  @ApiProperty(UserProps.email)
  @Column({ unique: true })
  email: string;

  @ApiProperty(UserProps.username)
  @Column({ unique: true, length: 30 })
  username: string;

  @ApiProperty(UserProps.password)
  @Column({ select: false })
  password: string;

  @ApiPropertyOptional(UserProps.status)
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.DEACTIVATE })
  status: UserStatus;

  @ApiPropertyOptional(UserProps.role)
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @ApiProperty(UserProps.registryDates)
  @Column(() => RegistryDatesOrm, { prefix: false })
  registryDates: RegistryDatesOrm;

  @ApiProperty(UserProps.sessions)
  @OneToMany(() => Session, (session) => session.owner, {
    cascade: ['soft-remove', 'recover']
  })
  sessions: Session[];

  @ApiProperty(UserProps.isDeleted)
  get isDeleted() {
    return !!this.registryDates.deleteAt;
  }
}
