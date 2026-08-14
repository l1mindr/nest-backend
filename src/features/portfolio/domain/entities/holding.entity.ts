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

@Entity('holding')
@Index('IDX_holding_portfolio_asset', ['portfolioId', 'assetId'], {
  unique: true
})
@Index('IDX_holding_user_id', ['userId'])
@Index('IDX_holding_asset_id', ['assetId'])
@Check('CHK_holding_amount_positive', '"amount" > 0')
export class Holding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  portfolioId!: string;

  @Column({ type: 'uuid' })
  assetId!: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount!: string;

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
