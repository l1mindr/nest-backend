import { Inject, Injectable } from '@nestjs/common';
import { Wallet } from '../../domain/entities/wallet.entity';
import {
  IListWalletsUseCase,
  IWalletRepository,
  WALLET_REPOSITORY
} from '../interfaces/wallet.interface';

@Injectable()
export class ListWalletsUseCase implements IListWalletsUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository
  ) {}

  async execute(userId: string): Promise<Wallet[]> {
    return this.walletRepository.findByUserId(userId);
  }
}
