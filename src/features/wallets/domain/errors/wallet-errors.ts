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
}
