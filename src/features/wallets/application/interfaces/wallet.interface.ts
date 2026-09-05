import { Wallet } from '../../domain/entities/wallet.entity';
import { WalletNetwork } from '../../domain/enums/wallet-network.enum';
import { CreateWalletRequestDto } from '../../presentation/dto/request/create-wallet.request.dto';
import { UpdateWalletRequestDto } from '../../presentation/dto/request/update-wallet.request.dto';

export const WALLET_REPOSITORY = Symbol('IWalletRepository');

/** One network-specific address, as the repository takes it. */
export interface WalletAddressData {
  network: WalletNetwork;
  address: string;
}

export interface CreateWalletData {
  userId: string;
  name: string;
  addresses: WalletAddressData[];
}

/**
 * Partial by design: only the keys present are written. `addresses`, when
 * present, is the wallet's complete new set — the repository reconciles it
 * against what is stored rather than merging.
 */
export interface UpdateWalletData {
  name?: string;
  addresses?: WalletAddressData[];
}

export interface IWalletRepository {
  create(data: CreateWalletData): Promise<Wallet>;
  findByIdAndUser(id: string, userId: string): Promise<Wallet | null>;
  findByUserId(userId: string): Promise<Wallet[]>;
  update(
    id: string,
    userId: string,
    data: UpdateWalletData
  ): Promise<Wallet | null>;
  delete(id: string, userId: string): Promise<boolean>;
  /** How many transactions name this wallet as their transfer destination. */
  countTransactionReferences(id: string): Promise<number>;
}

export interface ICreateWalletUseCase {
  execute(userId: string, dto: CreateWalletRequestDto): Promise<Wallet>;
}

export const CREATE_WALLET_USE_CASE = Symbol('ICreateWalletUseCase');

export interface IListWalletsUseCase {
  execute(userId: string): Promise<Wallet[]>;
}

export const LIST_WALLETS_USE_CASE = Symbol('IListWalletsUseCase');

export interface IUpdateWalletUseCase {
  execute(
    walletId: string,
    userId: string,
    dto: UpdateWalletRequestDto
  ): Promise<Wallet>;
}

export const UPDATE_WALLET_USE_CASE = Symbol('IUpdateWalletUseCase');

export interface IDeleteWalletUseCase {
  execute(walletId: string, userId: string): Promise<void>;
}

export const DELETE_WALLET_USE_CASE = Symbol('IDeleteWalletUseCase');
