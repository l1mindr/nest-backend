import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';
import { WalletNetwork } from '../enums/wallet-network.enum';
import { Wallet } from './wallet.entity';

/**
 * One network-specific address belonging to a wallet.
 *
 * A wallet is a single named identity that can hold an address on several
 * chains, so the addresses live in a child table rather than as columns on
 * `wallet` — which is what lets the set grow without a migration per chain.
 *
 * The unique constraint is the database's half of "a network appears at most
 * once per wallet"; the request DTO rejects duplicates before they get here,
 * and this backstops it.
 */
@Entity('wallet_address')
@Unique('uq_wallet_address_wallet_network', ['walletId', 'network'])
@Index('IDX_wallet_address_wallet_id', ['walletId'])
export class WalletAddress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  walletId!: string;

  @Column({
    type: 'enum',
    enum: WalletNetwork,
    enumName: 'wallet_network_enum'
  })
  network!: WalletNetwork;

  @Column({ length: 255 })
  address!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  // Deleting the wallet takes its addresses with it: an address has no
  // meaning without the wallet that owns it, unlike a transaction, which is
  // history and is guarded separately.
  @ManyToOne(() => Wallet, (wallet) => wallet.addresses, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'walletId' })
  wallet!: Wallet;
}
