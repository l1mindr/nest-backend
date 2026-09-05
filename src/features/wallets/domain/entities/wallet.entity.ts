import { User } from '@features/users/domain/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { WalletAddress } from './wallet-address.entity';

/**
 * A wallet the user owns: one name, and an address per blockchain network it
 * holds funds on.
 *
 * The addresses are a child collection rather than a column, so "Ledger X" is
 * one wallet with a Solana, a Bitcoin and an Ethereum address — not three
 * wallets that happen to share a name.
 */
@Entity('wallet')
@Index('IDX_wallet_user_id', ['userId'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ length: 100 })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => WalletAddress, (address) => address.wallet, {
    cascade: ['insert', 'update']
  })
  addresses!: WalletAddress[];

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'userId' })
  owner!: User;
}
