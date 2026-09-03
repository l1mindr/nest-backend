import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from '../../domain/entities/wallet.entity';
import {
  CreateWalletData,
  IWalletRepository
} from '../../application/interfaces/wallet.interface';

@Injectable()
export class WalletRepository implements IWalletRepository {
  private get walletRepo(): Repository<Wallet> {
    return this.dataSource.getRepository(Wallet);
  }

  constructor(private readonly dataSource: DataSource) {}

  async create(data: CreateWalletData): Promise<Wallet> {
    const wallet = this.walletRepo.create(data);

    return this.walletRepo.save(wallet);
  }

  async findByIdAndUser(id: string, userId: string): Promise<Wallet | null> {
    return this.walletRepo.findOne({ where: { id, userId } });
  }

  async findByUserId(userId: string): Promise<Wallet[]> {
    return this.walletRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }
}
