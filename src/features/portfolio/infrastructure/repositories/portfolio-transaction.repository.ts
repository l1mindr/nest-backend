import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import {
  CreatePortfolioTransactionData,
  IPortfolioTransactionRepository,
  ListPortfolioTransactionsFilter,
  UpdatePortfolioTransactionData
} from '../../application/interfaces/portfolio.interface';

@Injectable()
export class PortfolioTransactionRepository implements IPortfolioTransactionRepository {
  private get transactionRepo(): Repository<PortfolioTransaction> {
    return this.dataSource.getRepository(PortfolioTransaction);
  }

  constructor(private readonly dataSource: DataSource) {}

  async create(
    data: CreatePortfolioTransactionData
  ): Promise<PortfolioTransaction> {
    const transaction = this.transactionRepo.create(data);

    return this.transactionRepo.save(transaction);
  }

  async findByIdAndPortfolioAndUser(
    id: string,
    portfolioId: string,
    userId: string
  ): Promise<PortfolioTransaction | null> {
    return this.transactionRepo.findOne({
      where: { id, portfolioId, userId },
      relations: { asset: true, portfolio: true }
    });
  }

  async listByPortfolioAndUser(
    filter: ListPortfolioTransactionsFilter
  ): Promise<PortfolioTransaction[]> {
    const qb = this.transactionRepo
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.asset', 'asset')
      .where('transaction.userId = :userId', { userId: filter.userId })
      .andWhere('transaction.portfolioId = :portfolioId', {
        portfolioId: filter.portfolioId
      });

    if (filter.assetId) {
      qb.andWhere('transaction.assetId = :assetId', {
        assetId: filter.assetId
      });
    }

    if (filter.type) {
      qb.andWhere('transaction.type = :type', { type: filter.type });
    }

    if (filter.from) {
      qb.andWhere('transaction.occurredAt >= :from', { from: filter.from });
    }

    if (filter.to) {
      qb.andWhere('transaction.occurredAt <= :to', { to: filter.to });
    }

    if (filter.cursor) {
      qb.andWhere(
        '(transaction.occurredAt < :cursorOccurredAt OR (transaction.occurredAt = :cursorOccurredAt AND transaction.id < :cursorId))',
        {
          cursorOccurredAt: filter.cursor.occurredAt,
          cursorId: filter.cursor.id
        }
      );
    }

    return qb
      .orderBy('transaction.occurredAt', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .take(filter.limit)
      .getMany();
  }

  async listForPnl(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioTransaction[]> {
    return this.transactionRepo
      .createQueryBuilder('transaction')
      .leftJoin('transaction.asset', 'asset')
      .select([
        'transaction.id',
        'transaction.assetId',
        'transaction.type',
        'transaction.amount',
        'transaction.price',
        'transaction.fee',
        'transaction.occurredAt',
        'asset.symbol',
        'asset.name',
        'asset.currentPrice'
      ])
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.portfolioId = :portfolioId', { portfolioId })
      .orderBy('transaction.occurredAt', 'ASC')
      .addOrderBy('transaction.id', 'ASC')
      .getMany();
  }

  async deleteByIdAndPortfolioAndUser(
    id: string,
    portfolioId: string,
    userId: string
  ): Promise<boolean> {
    const result = await this.transactionRepo.delete({
      id,
      portfolioId,
      userId
    });

    return (result.affected ?? 0) === 1;
  }

  async update(
    id: string,
    portfolioId: string,
    userId: string,
    data: UpdatePortfolioTransactionData
  ): Promise<PortfolioTransaction | null> {
    await this.transactionRepo.update({ id, portfolioId, userId }, data);

    return this.findByIdAndPortfolioAndUser(id, portfolioId, userId);
  }
}
