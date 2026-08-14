import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PortfolioCalculationCheckpoint } from '../../domain/entities/portfolio-calculation-checkpoint.entity';
import { CostBasisStrategy } from '../../domain/calculation/types/cost-basis.strategy.enum';
import {
  IPortfolioCalculationCheckpointRepository,
  SaveCheckpointData
} from '../../application/interfaces/portfolio.interface';

@Injectable()
export class PortfolioCalculationCheckpointRepository implements IPortfolioCalculationCheckpointRepository {
  private get repo(): Repository<PortfolioCalculationCheckpoint> {
    return this.dataSource.getRepository(PortfolioCalculationCheckpoint);
  }

  constructor(private readonly dataSource: DataSource) {}

  async withAssetLock<T>(
    portfolioId: string,
    assetId: string,
    work: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // pg_advisory_xact_lock is released automatically when the transaction
      // commits or rolls back. hashtext hashes both UUIDs to int4 keys; a
      // collision only over-serializes distinct assets, it never corrupts.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        [portfolioId, assetId]
      );
      return work(manager);
    });
  }

  private repoFor(
    manager?: EntityManager
  ): Repository<PortfolioCalculationCheckpoint> {
    return manager
      ? manager.getRepository(PortfolioCalculationCheckpoint)
      : this.repo;
  }

  async findByScope(
    portfolioId: string,
    assetId: string,
    strategy: CostBasisStrategy
  ): Promise<PortfolioCalculationCheckpoint | null> {
    return this.repo.findOne({
      where: { portfolioId, assetId, costBasisStrategy: strategy }
    });
  }

  async save(data: SaveCheckpointData, manager?: EntityManager): Promise<void> {
    await this.repoFor(manager).upsert(
      {
        portfolioId: data.portfolioId,
        assetId: data.assetId,
        costBasisStrategy: data.costBasisStrategy,
        lastTransactionId: data.lastTransactionId,
        lastTransactionOccurredAt: data.lastTransactionOccurredAt,
        quantity: data.quantity,
        totalCost: data.totalCost,
        lots: data.lots,
        realizedPnlEvents: data.realizedPnlEvents,
        openingBalanceUpdatedAt: data.openingBalanceUpdatedAt
      },
      ['portfolioId', 'assetId', 'costBasisStrategy']
    );
  }

  async deleteByPortfolioAndAsset(
    portfolioId: string,
    assetId: string,
    manager?: EntityManager
  ): Promise<void> {
    await this.repoFor(manager).delete({ portfolioId, assetId });
  }

  async deleteByPortfolio(
    portfolioId: string,
    manager?: EntityManager
  ): Promise<void> {
    await this.repoFor(manager).delete({ portfolioId });
  }
}
