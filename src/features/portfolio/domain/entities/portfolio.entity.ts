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
import { PortfolioSourceType } from '../enums/portfolio-source-type.enum';

@Entity('portfolio')
@Index('IDX_portfolio_user_id', ['userId'])
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({
    type: 'enum',
    enum: PortfolioSourceType,
    enumName: 'portfolio_source_type_enum'
  })
  sourceType!: PortfolioSourceType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  walletAddress!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'userId' })
  owner!: User;
}
