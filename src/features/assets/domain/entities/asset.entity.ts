import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';

@Entity('asset')
@Unique('uq_asset_coin_gecko_id', ['coinGeckoId'])
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_asset_coin_gecko_id')
  @Column({ length: 100 })
  coinGeckoId!: string;

  @Index('IDX_asset_symbol')
  @Column({ length: 32 })
  symbol!: string;

  @Index('IDX_asset_name')
  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'decimal', precision: 40, scale: 8, nullable: true })
  currentPrice!: string | null;

  @Column({ type: 'decimal', precision: 30, scale: 2, nullable: true })
  marketCap!: string | null;

  @Column({ type: 'integer', nullable: true })
  marketCapRank!: number | null;

  @Column({ type: 'decimal', precision: 30, scale: 2, nullable: true })
  totalVolume!: string | null;

  @Column({ type: 'decimal', precision: 40, scale: 8, nullable: true })
  circulatingSupply!: string | null;

  @Column({ type: 'decimal', precision: 40, scale: 8, nullable: true })
  totalSupply!: string | null;

  @Column({ type: 'decimal', precision: 40, scale: 8, nullable: true })
  maxSupply!: string | null;

  @Column({ type: 'decimal', precision: 40, scale: 8, nullable: true })
  priceChange24h!: string | null;

  @Column({ type: 'decimal', precision: 30, scale: 4, nullable: true })
  priceChangePercentage24h!: string | null;

  @Column({ type: 'timestamptz' })
  lastSyncedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
