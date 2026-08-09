import { User } from '@features/users/domain/entities/user.entity';
import { Asset } from '@features/assets/domain/entities/asset.entity';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { Portfolio } from './portfolio.entity';
import { PortfolioTransactionType } from '../enums/portfolio-transaction-type.enum';

@Entity('portfolio_transaction')
@Index('IDX_portfolio_transaction_user_id', ['userId'])
@Index('IDX_portfolio_transaction_portfolio_occurred', [
  'portfolioId',
  'occurredAt',
  'id'
])
@Index('IDX_portfolio_transaction_portfolio_asset', [
  'portfolioId',
  'assetId',
  'occurredAt'
])
@Check('CHK_portfolio_transaction_amount_positive', '"amount" > 0')
@Check('CHK_portfolio_transaction_price_positive', '"price" > 0')
@Check('CHK_portfolio_transaction_fee_nonnegative', '"fee" >= 0')
export class PortfolioTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  portfolioId!: string;

  @Column({ type: 'uuid' })
  assetId!: string;

  @Column({ type: 'enum', enum: PortfolioTransactionType })
  type!: PortfolioTransactionType;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount!: string;

  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true })
  price!: string | null;

  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true })
  fee!: string | null;

  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'userId' })
  owner!: User;

  @ManyToOne(() => Portfolio, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'portfolioId' })
  portfolio!: Portfolio;

  @ManyToOne(() => Asset, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'assetId' })
  asset!: Asset;
}
