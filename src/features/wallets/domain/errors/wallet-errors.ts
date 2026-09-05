import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { WalletErrorCode } from './wallet-error-code.enum';

export class WalletErrors {
  static walletNotFound(walletId?: string) {
    return new AppError(
      WalletErrorCode.WALLET_NOT_FOUND,
      ErrorDomain.WALLET,
      HttpStatus.NOT_FOUND,
      walletId ? { walletId } : undefined,
      'Wallet not found'
    );
  }

  static walletEmptyUpdate() {
    return new AppError(
      WalletErrorCode.WALLET_EMPTY_UPDATE,
      ErrorDomain.WALLET,
      HttpStatus.UNPROCESSABLE_ENTITY,
      undefined,
      'At least one field must be provided'
    );
  }

  /**
   * A wallet still named by at least one transaction cannot be removed.
   *
   * `portfolio_transaction.walletId` is a `NO ACTION` foreign key, so the
   * database would refuse the delete anyway; this turns that into a domain
   * error the client can act on, and carries the count so the message can say
   * how much history is holding the wallet in place. Detaching or deleting
   * those transactions is deliberately not offered — that is ledger history.
   */
  static walletInUse(walletId: string, transactionCount: number) {
    return new AppError(
      WalletErrorCode.WALLET_IN_USE,
      ErrorDomain.WALLET,
      HttpStatus.CONFLICT,
      { walletId, transactionCount },
      'Wallet is referenced by existing transactions'
    );
  }
}
