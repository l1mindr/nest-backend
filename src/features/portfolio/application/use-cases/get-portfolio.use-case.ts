import { Inject, Injectable } from '@nestjs/common';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  IGetPortfolioUseCase,
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class GetPortfolioUseCase implements IGetPortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository
  ) {}

  async execute(userId: string, portfolioId: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    return portfolio;
  }
}
