import { Inject, Injectable } from '@nestjs/common';
import { Wallet } from '../../domain/entities/wallet.entity';
import { WalletErrors } from '../../domain/errors/wallet-errors';
import { UpdateWalletRequestDto } from '../../presentation/dto/request/update-wallet.request.dto';
import {
  IUpdateWalletUseCase,
  IWalletRepository,
  UpdateWalletData,
  WALLET_REPOSITORY
} from '../interfaces/wallet.interface';

@Injectable()
export class UpdateWalletUseCase implements IUpdateWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository
  ) {}

  async execute(
    walletId: string,
    userId: string,
    dto: UpdateWalletRequestDto
  ): Promise<Wallet> {
    if (dto.name === undefined && dto.addresses === undefined) {
      throw WalletErrors.walletEmptyUpdate();
    }

    const data: UpdateWalletData = {};

    if (dto.name !== undefined) data.name = dto.name;

    // The array replaces the stored set wholesale — an empty one clears every
    // address — so the key is copied whenever it was sent; only `undefined`
    // means "leave the addresses alone".
    if (dto.addresses !== undefined) {
      data.addresses = dto.addresses.map((entry) => ({
        network: entry.network,
        address: entry.address
      }));
    }

    const updated = await this.walletRepository.update(walletId, userId, data);

    // A wallet owned by another account is reported as missing, so ownership
    // cannot be probed by identifier.
    if (!updated) {
      throw WalletErrors.walletNotFound(walletId);
    }

    return updated;
  }
}
