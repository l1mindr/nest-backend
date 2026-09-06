import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './domain/entities/wallet.entity';
import { WalletAddress } from './domain/entities/wallet-address.entity';
import { WalletRepository } from './infrastructure/repositories/wallet.repository';
import { CreateWalletUseCase } from './application/use-cases/create-wallet.use-case';
import { ListWalletsUseCase } from './application/use-cases/list-wallets.use-case';
import { UpdateWalletUseCase } from './application/use-cases/update-wallet.use-case';
import { DeleteWalletUseCase } from './application/use-cases/delete-wallet.use-case';
import { WalletMapper } from './application/mappers/wallet.mapper';
import { WalletsController } from './presentation/controllers/wallets.controller';
import {
  CREATE_WALLET_USE_CASE,
  DELETE_WALLET_USE_CASE,
  LIST_WALLETS_USE_CASE,
  UPDATE_WALLET_USE_CASE,
  WALLET_REPOSITORY
} from './application/interfaces/wallet.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, WalletAddress])],
  controllers: [WalletsController],
  providers: [
    WalletRepository,
    { provide: WALLET_REPOSITORY, useExisting: WalletRepository },
    CreateWalletUseCase,
    { provide: CREATE_WALLET_USE_CASE, useExisting: CreateWalletUseCase },
    ListWalletsUseCase,
    { provide: LIST_WALLETS_USE_CASE, useExisting: ListWalletsUseCase },
    UpdateWalletUseCase,
    { provide: UPDATE_WALLET_USE_CASE, useExisting: UpdateWalletUseCase },
    DeleteWalletUseCase,
    { provide: DELETE_WALLET_USE_CASE, useExisting: DeleteWalletUseCase },
    WalletMapper
  ],
  exports: [WALLET_REPOSITORY]
})
export class WalletsModule {}
