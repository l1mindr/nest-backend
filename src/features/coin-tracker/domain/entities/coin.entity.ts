import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';

/**
 * Persistence model. Never serialized to clients directly — the coins
 * endpoint projects it through `CoinResponseDto`.
 */
@Entity()
export class Coin {
  @PrimaryColumn()
  id!: string;

  @Column()
  symbol!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  image!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp' })
  lastSyncedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
