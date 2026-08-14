import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { CostBasisStrategy } from '../calculation/types/cost-basis.strategy.enum';
import { Lot } from '../calculation/lot';
import { RealizedPnlEvent } from '../calculation/types/calculation-result.types';

/**
 * Persisted intermediate calculation state for one (portfolioId, assetId,
 * costBasisStrategy) scope.
 *
 * A checkpoint records exactly how far through the chronological ledger a
 * previous P&L calculation reached, together with the full calculation state
 * at that point. On the next P&L request, if the ledger has not changed before
 * or at the checkpoint boundary, only the suffix of new transactions needs to
 * be processed.
 *
 * A checkpoint is NEVER a cached P&L result — it is reusable intermediate
 * state. The final market-price-dependent values (unrealized P&L, current
 * value) are never stored here.
 *
 * Invalidation: any mutation to portfolio_transaction or
 * portfolio_opening_balance within the scope deletes this row so the next
 * P&L request falls back to a full replay.
 */
@Entity('portfolio_calculation_checkpoint')
@Index(
  'IDX_pcc_portfolio_asset_strategy',
  ['portfolioId', 'assetId', 'costBasisStrategy'],
  { unique: true }
)
@Index('IDX_pcc_portfolio_id', ['portfolioId'])
export class PortfolioCalculationCheckpoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  portfolioId!: string;

  @Column({ type: 'uuid' })
  assetId!: string;

  @Column({ type: 'enum', enum: CostBasisStrategy })
  costBasisStrategy!: CostBasisStrategy;

  /**
   * The `id` of the last transaction that was included in this checkpoint.
   * Used together with `lastTransactionOccurredAt` to identify the exact
   * ledger position — a UUID alone is not enough because IDs are not ordered.
   */
  @Column({ type: 'uuid' })
  lastTransactionId!: string;

  /**
   * The `occurredAt` of the last processed transaction as an ISO 8601 string.
   * Stored as text to avoid any timezone coercion round-trip.
   */
  @Column({ type: 'varchar', length: 32 })
  lastTransactionOccurredAt!: string;

  /** Quantity held at the checkpoint boundary, as a decimal string. */
  @Column({ type: 'decimal', precision: 36, scale: 18 })
  quantity!: string;

  /** Accumulated acquisition cost at the checkpoint boundary, as a decimal string. */
  @Column({ type: 'decimal', precision: 60, scale: 26 })
  totalCost!: string;

  /**
   * Surviving FIFO/LIFO lots at the checkpoint boundary, serialized as JSON.
   * NULL for AVERAGE (which has no lot queue).
   * Shape: `Array<{ quantity: string; unitCost: string }>`.
   */
  @Column({ type: 'jsonb', nullable: true })
  lots!: Lot[] | null;

  /**
   * All realized P&L events accumulated through the checkpoint boundary.
   * Stored as JSONB so the application layer can serve them without replaying.
   */
  @Column({ type: 'jsonb' })
  realizedPnlEvents!: RealizedPnlEvent[];

  /**
   * The `updatedAt` of the `portfolio_opening_balance` row for this
   * (portfolioId, assetId) at the time the checkpoint was saved.
   * When null, there was no opening balance at save time.
   * Used to detect whether the opening balance changed since the checkpoint.
   */
  @Column({ type: 'timestamptz', nullable: true })
  openingBalanceUpdatedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
