import { Inject, Injectable } from '@nestjs/common';
import { WalletErrors } from '../../domain/errors/wallet-errors';
import {
  IDeleteWalletUseCase,
  IWalletRepository,
  WALLET_REPOSITORY
} from '../interfaces/wallet.interface';

@Injectable()
export class DeleteWalletUseCase implements IDeleteWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository
  ) {}

  async execute(walletId: string, userId: string): Promise<void> {
    // Ownership is established first so a wallet belonging to someone else is
    // reported as missing rather than as in use, which would leak that it
    // exists and how much history it carries.
    const wallet = await this.walletRepository.findByIdAndUser(
      walletId,
      userId
    );

    if (!wallet) {
      throw WalletErrors.walletNotFound(walletId);
    }

    // A transaction naming this wallet is ledger history. The delete is
    // refused rather than cascading, matching the `NO ACTION` foreign key —
    // no transaction is rewritten or removed to make room for it.
    const references =
      await this.walletRepository.countTransactionReferences(walletId);

    if (references > 0) {
      throw WalletErrors.walletInUse(walletId, references);
    }

    const deleted = await this.walletRepository.delete(walletId, userId);

    if (!deleted) {
      throw WalletErrors.walletNotFound(walletId);
    }
  }
}
