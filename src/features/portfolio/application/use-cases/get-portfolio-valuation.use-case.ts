import { multiplyDecimals, sumDecimals } from '@core/decimal/decimal.util';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PORTFOLIO_VALUATION_CURRENCY } from '../../domain/portfolio-valuation.constants';
import { PortfolioValuationStatus } from '../../domain/enums/portfolio-valuation-status.enum';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  HOLDING_REPOSITORY,
  IGetPortfolioValuationUseCase,
  IHoldingRepository,
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
  PortfolioHoldingValuation,
  PortfolioValuation
} from '../interfaces/portfolio.interface';

@Injectable()
export class GetPortfolioValuationUseCase implements IGetPortfolioValuationUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(HOLDING_REPOSITORY)
    private readonly holdingRepository: IHoldingRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GetPortfolioValuationUseCase.name);
  }

  async execute(
    userId: string,
    portfolioId: string
  ): Promise<PortfolioValuation> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const holdings = await this.holdingRepository.listForValuation(portfolioId);

    const items: PortfolioHoldingValuation[] = holdings.map((holding) => {
      const currentPrice = holding.asset.currentPrice;
      const value =
        currentPrice === null
          ? null
          : multiplyDecimals(holding.amount, currentPrice);

      return {
        holdingId: holding.id,
        assetId: holding.assetId,
        symbol: holding.asset.symbol,
        name: holding.asset.name,
        amount: holding.amount,
        currentPrice,
        value
      };
    });

    const valuedHoldings = items.filter((item) => item.value !== null);
    const unvaluedHoldings = items.length - valuedHoldings.length;
    const totalValue =
      valuedHoldings.length > 0
        ? sumDecimals(valuedHoldings.map((item) => item.value as string))
        : null;

    const status = this.resolveStatus(items.length, valuedHoldings.length);

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_VALUATION_COMPUTED,
        portfolioId,
        userId,
        status,
        valuedHoldings: valuedHoldings.length,
        unvaluedHoldings
      },
      'Portfolio valuation computed'
    );

    return {
      portfolioId,
      currency: PORTFOLIO_VALUATION_CURRENCY,
      totalValue,
      status,
      valuedHoldings: valuedHoldings.length,
      unvaluedHoldings,
      holdings: items
    };
  }

  private resolveStatus(
    holdingCount: number,
    valuedCount: number
  ): PortfolioValuationStatus {
    if (holdingCount === 0) {
      return PortfolioValuationStatus.EMPTY;
    }

    if (valuedCount === holdingCount) {
      return PortfolioValuationStatus.COMPLETE;
    }

    if (valuedCount === 0) {
      return PortfolioValuationStatus.UNAVAILABLE;
    }

    return PortfolioValuationStatus.PARTIAL;
  }
}
