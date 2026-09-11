import { User } from '@features/users/domain/entities/user.entity';
import { Asset } from '@features/assets/domain/entities/asset.entity';
import { Wallet } from '@features/wallets/domain/entities/wallet.entity';
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
import {
  DEFAULT_TRANSACTION_PRICE_CURRENCY,
  TransactionPriceCurrency
} from '../enums/transaction-price-currency.enum';
import { TransferDestinationType } from '../enums/transfer-destination-type.enum';

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
  'occurredAt',
  'id'
])
@Check('CHK_portfolio_transaction_amount_positive', '"amount" > 0')
@Check('CHK_portfolio_transaction_price_positive', '"price" > 0')
@Check('CHK_portfolio_transaction_fee_nonnegative', '"fee" >= 0')
// The as-entered values get the same guarantees as the USD ones they came
// from, so a converted row cannot hold a non-positive original.
@Check('CHK_portfolio_transaction_entered_price_positive', '"enteredPrice" > 0')
@Check('CHK_portfolio_transaction_entered_fee_nonnegative', '"enteredFee" >= 0')
@Check(
  'CHK_portfolio_transaction_usdt_toman_rate_positive',
  '"usdtTomanRate" > 0'
)
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

  /**
   * Price per unit in **USD**, whatever currency the user entered.
   *
   * This is the figure the cost-basis engine pools and the P&L compares
   * against a USD market price, so it is the one column that must never carry
   * another denomination. A Toman entry is converted before it lands here; see
   * `enteredPrice` for the untouched original.
   */
  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true })
  price!: string | null;

  /** Fee in **USD**, on the same terms as `price`. */
  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true })
  fee!: string | null;

  /**
   * The denomination the user entered `price` and `fee` in. `USD` for every
   * transaction recorded before Toman entry existed, which is exactly what
   * those rows already meant.
   */
  @Column({
    type: 'enum',
    enum: TransactionPriceCurrency,
    enumName: 'transaction_price_currency_enum',
    default: DEFAULT_TRANSACTION_PRICE_CURRENCY
  })
  priceCurrency!: TransactionPriceCurrency;

  /**
   * Price per unit exactly as the user typed it, in `priceCurrency`.
   *
   * `null` when `priceCurrency` is USD — there the entry and the stored USD
   * value are the same number, and duplicating it would create two places for
   * one fact to drift. Only a converted entry needs its original kept.
   */
  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true })
  enteredPrice!: string | null;

  /** Fee exactly as the user typed it, on the same terms as `enteredPrice`. */
  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true })
  enteredFee!: string | null;

  /**
   * Toman per 1 USDT used to convert this transaction, frozen at write time.
   *
   * Storing it is what makes the row historically stable: the live rate moves
   * constantly, and re-deriving the conversion later would silently restate
   * what the user paid. `null` when no conversion happened.
   */
  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true })
  usdtTomanRate!: string | null;

  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  /**
   * Counterparty of a TRANSFER_IN/TRANSFER_OUT — where it came from or went
   * to. `null` for BUY/SELL, which have no destination concept.
   */
  @Column({
    type: 'enum',
    enum: TransferDestinationType,
    enumName: 'transfer_destination_type_enum',
    nullable: true
  })
  destinationType!: TransferDestinationType | null;

  /** Free-text exchange name, required when `destinationType` is EXCHANGE. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  exchangeName!: string | null;

  /** Optional on-chain transaction id, only meaningful for EXCHANGE transfers. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  txid!: string | null;

  /** Set when `destinationType` is WALLET; the wallet must belong to the same user. */
  @Column({ type: 'uuid', nullable: true })
  walletId!: string | null;

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

  @ManyToOne(() => Wallet, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'walletId' })
  wallet!: Wallet | null;
}
