import { Session } from '@features/sessions/domain/entities/session.entity';
import { RegistryDatesOrm } from '@infrastructure/databases/postgres/embedded/registry-dates.embedded';
import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { UserErrors } from '../errors/user-errors';

/**
 * Persistence model. Never serialized to clients directly — presentation goes
 * through the response DTOs, which is what keeps `password` out of the API
 * surface and out of the OpenAPI schema.
 */
@Entity()
@Unique('users_email_unique', ['email'])
@Unique('users_username_unique', ['username'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, select: false })
  name!: string | null;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true, length: 30 })
  username!: string;

  @Column({ select: false })
  password!: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION
  })
  status!: UserStatus;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column(() => RegistryDatesOrm, { prefix: false })
  registryDates!: RegistryDatesOrm;

  @OneToMany(() => Session, (session) => session.owner, {
    cascade: ['soft-remove', 'recover']
  })
  sessions!: Session[];

  get isDeleted() {
    return !!this.registryDates.deletedAt;
  }

  unsuspend(): void {
    if (this.status !== UserStatus.SUSPEND) {
      throw UserErrors.invalidStatusTransition(
        this.status,
        UserStatus.ACTIVATE
      );
    }
    this.status = UserStatus.ACTIVATE;
  }
}
