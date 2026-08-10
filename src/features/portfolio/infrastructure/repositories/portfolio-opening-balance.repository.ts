import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PortfolioOpeningBalance } from '../../domain/entities/portfolio-opening-balance.entity';
import {
  IPortfolioOpeningBalanceRepository,
  SetPortfolioOpeningBalanceData
} from '../../application/interfaces/portfolio.interface';

@Injectable()
export class PortfolioOpeningBalanceRepository implements IPortfolioOpeningBalanceRepository {
  private get openingBalanceRepo(): Repository<PortfolioOpeningBalance> {
    return this.dataSource.getRepository(PortfolioOpeningBalance);
  }

  constructor(private readonly dataSource: DataSource) {}

  async upsert(
    data: SetPortfolioOpeningBalanceData
  ): Promise<PortfolioOpeningBalance> {
    await this.openingBalanceRepo.upsert(data, ['portfolioId', 'assetId']);

    return this.openingBalanceRepo.findOneOrFail({
      where: {
        portfolioId: data.portfolioId,
        assetId: data.assetId,
        userId: data.userId
      },
      relations: { asset: true, portfolio: true }
    });
  }

  async listByPortfolioAndUser(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioOpeningBalance[]> {
    return this.openingBalanceRepo.find({
      where: { portfolioId, userId },
      relations: { asset: true, portfolio: true },
      order: { createdAt: 'ASC' }
    });
  }

  async listForPnl(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioOpeningBalance[]> {
    return this.openingBalanceRepo.find({
      where: { portfolioId, userId },
      relations: { asset: true },
      order: { assetId: 'ASC' }
    });
  }
}
