import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
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

  private repoFor(
    manager?: EntityManager
  ): Repository<PortfolioOpeningBalance> {
    return manager
      ? manager.getRepository(PortfolioOpeningBalance)
      : this.openingBalanceRepo;
  }

  async upsert(
    data: SetPortfolioOpeningBalanceData,
    manager?: EntityManager
  ): Promise<PortfolioOpeningBalance> {
    const repo = this.repoFor(manager);
    await repo.upsert(data, ['portfolioId', 'assetId']);

    return repo.findOneOrFail({
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

  async findUpdatedAtForCheckpoint(
    portfolioId: string,
    assetId: string,
    manager: EntityManager
  ): Promise<Date | null> {
    const row = await manager.getRepository(PortfolioOpeningBalance).findOne({
      where: { portfolioId, assetId },
      select: { updatedAt: true }
    });

    return row?.updatedAt ?? null;
  }
}
