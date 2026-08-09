import { multiplyDecimals, subtractDecimals } from '@core/decimal/decimal.util';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioCalculationEngine } from '../../domain/calculation/portfolio-calculation.engine';
import {
  CalculationTransaction,
  CalculationTransactionType
} from '../../domain/calculation/types/calculation-transaction.types';
import { CostBasisStrategy } from '../../domain/calculation/types/cost-basis.strategy.enum';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import { PortfolioTransactionType } from '../../domain/enums/portfolio-transaction-type.enum';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { PORTFOLIO_VALUATION_CURRENCY } from '../../domain/portfolio-valuation.constants';
import {
  IGetPortfolioPnlUseCase,
  IPortfolioCalculationEngineFactory,
  IPortfolioRepository,
  IPortfolioTransactionRepository,
  PORTFOLIO_CALCULATION_ENGINE,
  PORTFOLIO_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY,
  PortfolioPnlPosition,
  PortfolioPnlResult
} from '../interfaces/portfolio.interface';

/** The transactions of one asset, with the asset data the engine needs. */
interface AssetTransactionGroup {
  assetId: string;
  symbol: string;
  name: string;
  currentPrice: string | null;
  transactions: CalculationTransaction[];
}

/**
 * Computes the current P&L of a portfolio source on demand.
 *
 * The use case owns the application-side orchestration: it resolves the
 * portfolio, loads the complete ledger with prices, groups transactions by
 * asset, maps persistence models into calculation-domain transactions, runs
 * the calculation engine once per asset, and derives current value, realized
 * P&L, unrealized P&L and totals with exact decimal arithmetic.
 *
 * Nothing is persisted, nothing is cached, and no network call is made: the
 * only market-price input is `asset.currentPrice`.
 */
@Injectable()
export class GetPortfolioPnlUseCase implements IGetPortfolioPnlUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_CALCULATION_ENGINE)
    private readonly engineFactory: IPortfolioCalculationEngineFactory,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GetPortfolioPnlUseCase.name);
  }

  async execute(
    userId: string,
    portfolioId: string,
    strategy?: CostBasisStrategy
  ): Promise<PortfolioPnlResult> {
    const costBasisStrategy = strategy ?? CostBasisStrategy.AVERAGE;

    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const transactions = await this.transactionRepository.listForPnl(
      portfolioId,
      userId
    );

    const engine = this.engineFactory.create(costBasisStrategy);
    const positions = this.groupByAsset(transactions).map((group) =>
      this.calculatePosition(engine, group)
    );

    const pricedPositions = positions.filter(
      (position) => position.currentValue !== null
    ).length;
    const unpricedPositions = positions.length - pricedPositions;
    const allPriced = unpricedPositions === 0;

    const totalCostBasis = this.sumSigned(
      positions.map((position) => position.totalCost)
    );
    const totalRealizedPnl = this.sumSigned(
      positions.map((position) => position.realizedPnl)
    );

    const totalCurrentValue = allPriced
      ? this.sumSigned(
          positions.map((position) => position.currentValue as string)
        )
      : null;
    const totalUnrealizedPnl = allPriced
      ? this.sumSigned(
          positions.map((position) => position.unrealizedPnl as string)
        )
      : null;
    const totalPnl =
      allPriced && totalUnrealizedPnl !== null
        ? this.addSignedDecimals(totalRealizedPnl, totalUnrealizedPnl)
        : null;

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_PNL_COMPUTED,
        portfolioId,
        userId,
        costBasisStrategy,
        positionCount: positions.length,
        pricedPositions,
        unpricedPositions
      },
      'Portfolio P&L computed'
    );

    return {
      portfolioId,
      currency: PORTFOLIO_VALUATION_CURRENCY,
      costBasisStrategy,
      pricedPositions,
      unpricedPositions,
      totalCurrentValue,
      totalCostBasis,
      totalRealizedPnl,
      totalUnrealizedPnl,
      totalPnl,
      positions
    };
  }

  private calculatePosition(
    engine: PortfolioCalculationEngine,
    group: AssetTransactionGroup
  ): PortfolioPnlPosition {
    const result = engine.calculate({
      assetId: group.assetId,
      transactions: group.transactions
    });

    const realizedPnl = this.sumSigned(
      result.realizedPnl.map((event) => event.realizedPnl)
    );

    let currentValue: string | null = null;
    let unrealizedPnl: string | null = null;
    let totalPnl: string | null = null;

    if (group.currentPrice !== null) {
      currentValue = multiplyDecimals(result.quantity, group.currentPrice);
      unrealizedPnl = subtractDecimals(currentValue, result.totalCost);
      totalPnl = this.addSignedDecimals(realizedPnl, unrealizedPnl);
    }

    return {
      assetId: group.assetId,
      symbol: group.symbol,
      name: group.name,
      quantity: result.quantity,
      totalCost: result.totalCost,
      averageCost: result.averageCost,
      currentPrice: group.currentPrice,
      currentValue,
      realizedPnl,
      unrealizedPnl,
      totalPnl,
      realizedPnlEvents: result.realizedPnl
    };
  }

  private groupByAsset(
    transactions: PortfolioTransaction[]
  ): AssetTransactionGroup[] {
    const groups = new Map<string, AssetTransactionGroup>();

    for (const transaction of transactions) {
      let group = groups.get(transaction.assetId);

      if (!group) {
        const asset = transaction.asset;
        group = {
          assetId: transaction.assetId,
          symbol: asset.symbol,
          name: asset.name,
          currentPrice: asset.currentPrice,
          transactions: []
        };
        groups.set(transaction.assetId, group);
      }

      group.transactions.push(this.toCalculationTransaction(transaction));
    }

    return [...groups.values()];
  }

  private toCalculationTransaction(
    transaction: PortfolioTransaction
  ): CalculationTransaction {
    return {
      id: transaction.id,
      type: this.toCalculationType(transaction.type),
      amount: transaction.amount,
      price: transaction.price ?? undefined,
      fee: transaction.fee ?? undefined,
      occurredAt: transaction.occurredAt.toISOString()
    };
  }

  private toCalculationType(
    type: PortfolioTransactionType
  ): CalculationTransactionType {
    switch (type) {
      case PortfolioTransactionType.BUY:
        return CalculationTransactionType.BUY;
      case PortfolioTransactionType.SELL:
        return CalculationTransactionType.SELL;
      case PortfolioTransactionType.TRANSFER_IN:
        return CalculationTransactionType.TRANSFER_IN;
      case PortfolioTransactionType.TRANSFER_OUT:
        return CalculationTransactionType.TRANSFER_OUT;
      default:
        throw PortfolioErrors.transactionTypeNotSupported();
    }
  }

  private addSignedDecimals(left: string, right: string): string {
    return subtractDecimals(left, subtractDecimals('0', right));
  }

  private sumSigned(values: string[]): string {
    return values.reduce(
      (total, value) => this.addSignedDecimals(total, value),
      '0'
    );
  }
}
