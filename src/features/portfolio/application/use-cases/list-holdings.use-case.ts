import { compareDecimals } from '@core/decimal/decimal.util';
import { Inject, Injectable } from '@nestjs/common';
import { HoldingsService } from '../../infrastructure/providers/holdings.service';
import {
  DerivedHolding,
  IListHoldingsUseCase,
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

/**
 * Lists holdings derived from the transaction ledger.
 *
 * The `holding` table is deliberately not read: transactions are the source of
 * truth, so what this returns always agrees with portfolio valuation and with
 * the quantities oversell validation measures against.
 */
@Injectable()
export class ListHoldingsUseCase implements IListHoldingsUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly holdingsService: HoldingsService
  ) {}

  async execute(
    userId: string,
    options: { portfolioId?: string }
  ): Promise<DerivedHolding[]> {
    // `portfolioId` is an optional filter: without it the endpoint returns
    // every holding the user has, so each of their portfolios is derived.
    const portfolioIds = options.portfolioId
      ? [options.portfolioId]
      : (await this.portfolioRepository.findByUserId(userId)).map(
          (portfolio) => portfolio.id
        );

    const derived = await Promise.all(
      portfolioIds.map((portfolioId) =>
        this.holdingsService.getPortfolioHoldings(portfolioId, userId)
      )
    );

    // A position the user has fully sold nets to zero and is no longer held.
    return derived
      .flat()
      .filter((holding) => compareDecimals(holding.amount, '0') !== 0);
  }
}
