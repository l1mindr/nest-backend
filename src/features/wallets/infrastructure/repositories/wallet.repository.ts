import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsOrder,
  In,
  Repository
} from 'typeorm';
import { Wallet } from '../../domain/entities/wallet.entity';
import { WalletAddress } from '../../domain/entities/wallet-address.entity';
import {
  CreateWalletData,
  IWalletRepository,
  UpdateWalletData,
  WalletAddressData
} from '../../application/interfaces/wallet.interface';

@Injectable()
export class WalletRepository implements IWalletRepository {
  private get walletRepo(): Repository<Wallet> {
    return this.dataSource.getRepository(Wallet);
  }

  private get addressRepo(): Repository<WalletAddress> {
    return this.dataSource.getRepository(WalletAddress);
  }

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Addresses are ordered by network so a wallet's card renders its chains in
   * the same order on every request, rather than in insertion order.
   */
  private static readonly ADDRESS_ORDER: FindOptionsOrder<Wallet> = {
    addresses: { network: 'ASC' }
  };

  async create(data: CreateWalletData): Promise<Wallet> {
    const wallet = this.walletRepo.create({
      userId: data.userId,
      name: data.name,
      addresses: data.addresses.map((entry) =>
        this.addressRepo.create({
          network: entry.network,
          address: entry.address
        })
      )
    });

    // `cascade: ['insert']` on the relation writes the child rows in the same
    // save, so the wallet and its addresses land together or not at all.
    const saved = await this.walletRepo.save(wallet);

    return (await this.findById(saved.id)) ?? saved;
  }

  private async findById(id: string): Promise<Wallet | null> {
    return this.walletRepo.findOne({
      where: { id },
      relations: { addresses: true },
      order: WalletRepository.ADDRESS_ORDER
    });
  }

  async findByIdAndUser(id: string, userId: string): Promise<Wallet | null> {
    return this.walletRepo.findOne({
      where: { id, userId },
      relations: { addresses: true },
      order: WalletRepository.ADDRESS_ORDER
    });
  }

  async findByUserId(userId: string): Promise<Wallet[]> {
    return this.walletRepo.find({
      where: { userId },
      relations: { addresses: true },
      order: { createdAt: 'DESC', ...WalletRepository.ADDRESS_ORDER }
    });
  }

  /**
   * Applies `data` and returns the stored wallet, or `null` when it does not
   * belong to the caller. `userId` is part of the criteria rather than checked
   * beforehand, so another account's wallet can never be written.
   *
   * When `addresses` is present it is the wallet's complete new set, so the
   * write is a reconciliation: networks no longer listed are deleted, new ones
   * inserted, and existing ones updated in place. Everything runs in one
   * transaction — a half-applied address set would leave the wallet claiming
   * chains it no longer has.
   */
  async update(
    id: string,
    userId: string,
    data: UpdateWalletData
  ): Promise<Wallet | null> {
    const owned = await this.walletRepo.findOne({
      where: { id, userId },
      select: { id: true }
    });

    if (!owned) return null;

    await this.dataSource.transaction(async (manager) => {
      if (data.name !== undefined) {
        await manager.update(Wallet, { id, userId }, { name: data.name });
      }

      if (data.addresses !== undefined) {
        await this.reconcileAddresses(manager, id, data.addresses);
      }
    });

    return this.findById(id);
  }

  /** Deletes, inserts and updates so the stored set matches `next` exactly. */
  private async reconcileAddresses(
    manager: EntityManager,
    walletId: string,
    next: WalletAddressData[]
  ): Promise<void> {
    const existing = await manager.find(WalletAddress, { where: { walletId } });
    const nextNetworks = new Set(next.map((entry) => entry.network));

    const removed = existing.filter(
      (entry) => !nextNetworks.has(entry.network)
    );

    if (removed.length > 0) {
      await manager.delete(WalletAddress, {
        id: In(removed.map((entry) => entry.id))
      });
    }

    for (const entry of next) {
      const current = existing.find((row) => row.network === entry.network);

      if (!current) {
        await manager.insert(WalletAddress, {
          walletId,
          network: entry.network,
          address: entry.address
        });
        continue;
      }

      // Skip a no-op write so `updatedAt` only moves when the address did.
      if (current.address !== entry.address) {
        await manager.update(
          WalletAddress,
          { id: current.id },
          { address: entry.address }
        );
      }
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    // `wallet_address` cascades on the foreign key, so the child rows go with
    // the wallet without a second statement.
    const result = await this.walletRepo.delete({ id, userId });

    return Boolean(result.affected);
  }

  /**
   * Counts the transactions pointing at this wallet.
   *
   * The table is named rather than the `PortfolioTransaction` entity imported:
   * the portfolio module already depends on this one for the wallet entity and
   * the `WALLET_REPOSITORY` token, so importing it back would close a cycle
   * between the two features. The column is the `NO ACTION` foreign key added
   * in `1700000018000-AddTransferDestinationToPortfolioTransaction`.
   */
  async countTransactionReferences(id: string): Promise<number> {
    return this.dataSource
      .createQueryBuilder()
      .from('portfolio_transaction', 'transaction')
      .where('transaction."walletId" = :id', { id })
      .getCount();
  }
}
