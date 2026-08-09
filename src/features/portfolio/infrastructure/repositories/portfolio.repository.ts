import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import {
  CreatePortfolioData,
  IPortfolioRepository
} from '../../application/interfaces/portfolio.interface';

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  private get portfolioRepo(): Repository<Portfolio> {
    return this.dataSource.getRepository(Portfolio);
  }

  constructor(private readonly dataSource: DataSource) {}

  async create(data: CreatePortfolioData): Promise<Portfolio> {
    const portfolio = this.portfolioRepo.create(data);

    return this.portfolioRepo.save(portfolio);
  }

  async findByIdAndUser(id: string, userId: string): Promise<Portfolio | null> {
    return this.portfolioRepo.findOne({ where: { id, userId } });
  }

  async findByUserId(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }
}
