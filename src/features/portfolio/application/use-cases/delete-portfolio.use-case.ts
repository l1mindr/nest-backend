import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  IDeletePortfolioUseCase,
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class DeletePortfolioUseCase implements IDeletePortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(DeletePortfolioUseCase.name);
  }

  async execute(portfolioId: string, userId: string): Promise<void> {
    const deleted = await this.portfolioRepository.delete(portfolioId, userId);

    if (!deleted) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_DELETED,
        portfolioId,
        userId
      },
      'Portfolio source deleted'
    );
  }
}
