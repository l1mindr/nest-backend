import { Wallet } from '../../domain/entities/wallet.entity';
import { CreateWalletRequestDto } from '../../presentation/dto/request/create-wallet.request.dto';

export const WALLET_REPOSITORY = Symbol('IWalletRepository');

export interface CreateWalletData {
  userId: string;
  name: string;
  address: string | null;
}

export interface IWalletRepository {
  create(data: CreateWalletData): Promise<Wallet>;
  findByIdAndUser(id: string, userId: string): Promise<Wallet | null>;
  findByUserId(userId: string): Promise<Wallet[]>;
}

export interface ICreateWalletUseCase {
  execute(userId: string, dto: CreateWalletRequestDto): Promise<Wallet>;
}

export const CREATE_WALLET_USE_CASE = Symbol('ICreateWalletUseCase');

export interface IListWalletsUseCase {
  execute(userId: string): Promise<Wallet[]>;
}

export const LIST_WALLETS_USE_CASE = Symbol('IListWalletsUseCase');
