import { Inject, Injectable } from '@nestjs/common';
import { PortfolioOpeningBalance } from '../../domain/entities/portfolio-opening-balance.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  IListPortfolioOpeningBalancesUseCase,
  IPortfolioOpeningBalanceRepository,
  IPortfolioRepository,
  PORTFOLIO_OPENING_BALANCE_REPOSITORY,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class ListPortfolioOpeningBalancesUseCase implements IListPortfolioOpeningBalancesUseCase {
  constructor(
    @Inject(PORTFOLIO_OPENING_BALANCE_REPOSITORY)
    private readonly openingBalanceRepository: IPortfolioOpeningBalanceRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository
  ) {}

  async execute(
    userId: string,
    portfolioId: string
  ): Promise<PortfolioOpeningBalance[]> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    return this.openingBalanceRepository.listByPortfolioAndUser(
      portfolioId,
      userId
    );
  }
}
