import { Inject, Injectable } from '@nestjs/common';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import {
  IListPortfoliosUseCase,
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class ListPortfoliosUseCase implements IListPortfoliosUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository
  ) {}

  async execute(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepository.findByUserId(userId);
  }
}
