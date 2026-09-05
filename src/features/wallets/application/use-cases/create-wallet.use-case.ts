import { Inject, Injectable } from '@nestjs/common';
import { Wallet } from '../../domain/entities/wallet.entity';
import { CreateWalletRequestDto } from '../../presentation/dto/request/create-wallet.request.dto';
import {
  CreateWalletData,
  ICreateWalletUseCase,
  IWalletRepository,
  WALLET_REPOSITORY
} from '../interfaces/wallet.interface';

@Injectable()
export class CreateWalletUseCase implements ICreateWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository
  ) {}

  async execute(userId: string, dto: CreateWalletRequestDto): Promise<Wallet> {
    const data: CreateWalletData = {
      userId,
      name: dto.name,
      // A wallet may be registered before any address is known, so an omitted
      // list is an empty one rather than a rejection.
      addresses: (dto.addresses ?? []).map((entry) => ({
        network: entry.network,
        address: entry.address
      }))
    };

    return this.walletRepository.create(data);
  }
}
