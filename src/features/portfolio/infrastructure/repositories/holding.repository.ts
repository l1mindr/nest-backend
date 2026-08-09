import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Holding } from '../../domain/entities/holding.entity';
import {
  CreateHoldingData,
  IHoldingRepository,
  UpdateHoldingData
} from '../../application/interfaces/portfolio.interface';

@Injectable()
export class HoldingRepository implements IHoldingRepository {
  private get holdingRepo(): Repository<Holding> {
    return this.dataSource.getRepository(Holding);
  }

  constructor(private readonly dataSource: DataSource) {}

  async create(data: CreateHoldingData): Promise<Holding> {
    const holding = this.holdingRepo.create(data);

    return this.holdingRepo.save(holding);
  }

  async findByIdAndUser(id: string, userId: string): Promise<Holding | null> {
    return this.holdingRepo.findOne({
      where: { id, userId },
      relations: { asset: true, portfolio: true }
    });
  }

  async findByPortfolioAndAsset(
    portfolioId: string,
    assetId: string
  ): Promise<Holding | null> {
    return this.holdingRepo.findOneBy({ portfolioId, assetId });
  }

  async listByUser(
    userId: string,
    options: { portfolioId?: string }
  ): Promise<Holding[]> {
    const qb = this.holdingRepo
      .createQueryBuilder('holding')
      .leftJoinAndSelect('holding.asset', 'asset')
      .leftJoinAndSelect('holding.portfolio', 'portfolio')
      .where('holding.userId = :userId', { userId });

    if (options.portfolioId) {
      qb.andWhere('holding.portfolioId = :portfolioId', {
        portfolioId: options.portfolioId
      });
    }

    return qb.orderBy('holding.createdAt', 'ASC').getMany();
  }

  async update(
    id: string,
    userId: string,
    data: UpdateHoldingData
  ): Promise<Holding | null> {
    await this.holdingRepo.update({ id, userId }, data);

    return this.findByIdAndUser(id, userId);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.holdingRepo.delete({ id, userId });

    return (result.affected ?? 0) === 1;
  }
}
