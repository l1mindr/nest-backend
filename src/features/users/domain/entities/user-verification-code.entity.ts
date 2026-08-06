import { RegistryDatesOrm } from '@infrastructure/databases/postgres/embedded/registry-dates.embedded';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class UserVerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  codeHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column(() => RegistryDatesOrm, { prefix: false })
  registryDates!: RegistryDatesOrm;
}
