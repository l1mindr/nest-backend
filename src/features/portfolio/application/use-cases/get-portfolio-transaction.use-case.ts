import { Inject, Injectable } from '@nestjs/common';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  IGetPortfolioTransactionUseCase,
  IPortfolioRepository,
  IPortfolioTransactionRepository,
  PORTFOLIO_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class GetPortfolioTransactionUseCase implements IGetPortfolioTransactionUseCase {
  constructor(
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository
  ) {}

  async execute(
    userId: string,
    portfolioId: string,
    transactionId: string
  ): Promise<PortfolioTransaction> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const transaction =
      await this.transactionRepository.findByIdAndPortfolioAndUser(
        transactionId,
        portfolioId,
        userId
      );

    if (!transaction) {
      throw PortfolioErrors.transactionNotFound(transactionId);
    }

    return transaction;
  }
}
