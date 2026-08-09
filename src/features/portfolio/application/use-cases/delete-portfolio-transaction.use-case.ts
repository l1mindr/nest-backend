import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  IDeletePortfolioTransactionUseCase,
  IPortfolioRepository,
  IPortfolioTransactionRepository,
  PORTFOLIO_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class DeletePortfolioTransactionUseCase implements IDeletePortfolioTransactionUseCase {
  constructor(
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(DeletePortfolioTransactionUseCase.name);
  }

  async execute(
    userId: string,
    portfolioId: string,
    transactionId: string
  ): Promise<void> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const deleted =
      await this.transactionRepository.deleteByIdAndPortfolioAndUser(
        transactionId,
        portfolioId,
        userId
      );

    if (!deleted) {
      throw PortfolioErrors.transactionNotFound(transactionId);
    }

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_TRANSACTION_DELETED,
        transactionId,
        userId,
        portfolioId
      },
      'Portfolio transaction deleted'
    );
  }
}
