import {
  compareDecimals,
  multiplyDecimals,
  sumDecimals
} from '@core/decimal/decimal.util';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PORTFOLIO_VALUATION_CURRENCY } from '../../domain/portfolio-valuation.constants';
import { PortfolioValuationStatus } from '../../domain/enums/portfolio-valuation-status.enum';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { HoldingsService } from '../../infrastructure/providers/holdings.service';
import {
  IGetPortfolioValuationUseCase,
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
    private readonly holdingsService: HoldingsService,
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

    // Priced from ledger-derived holdings, so valuation cannot drift from what
    // `GET /v1/holdings` reports. Fully-exited positions are worth nothing and
    // would otherwise count as unvalued.
    const holdings = (
      await this.holdingsService.getPortfolioHoldings(portfolioId, userId)
    ).filter((holding) => compareDecimals(holding.amount, '0') !== 0);

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

    // The oldest sync instant among the holdings that could actually be
    // priced. Reporting the oldest rather than the newest keeps the value a
    // floor: the valuation is at least this fresh. `null` when nothing was
    // priced, since there is then no price age to report.
    const pricedAt = this.resolvePricedAt(holdings, items);

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
      holdings: items,
      pricedAt
    };
  }

  /**
   * Age of the price data behind this valuation.
   *
   * `asset.currentPrice` is written by the hourly `asset-sync` job, so a
   * valuation can legitimately be an hour behind the live `/v1/market/*`
   * tickers shown elsewhere on the dashboard. Surfacing `lastSyncedAt` lets the
   * client say so instead of presenting the total as if it were live.
   */
  private resolvePricedAt(
    holdings: { assetId: string; asset: { lastSyncedAt: Date } }[],
    items: PortfolioHoldingValuation[]
  ): Date | null {
    const pricedAssetIds = new Set(
      items.filter((item) => item.value !== null).map((item) => item.assetId)
    );

    const timestamps = holdings
      .filter((holding) => pricedAssetIds.has(holding.assetId))
      .map((holding) => holding.asset.lastSyncedAt)
      .filter((value): value is Date => value instanceof Date);

    if (timestamps.length === 0) return null;

    return timestamps.reduce((oldest, current) =>
      current.getTime() < oldest.getTime() ? current : oldest
    );
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
