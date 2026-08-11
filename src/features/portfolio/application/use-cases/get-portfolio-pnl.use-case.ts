import { multiplyDecimals, subtractDecimals } from '@core/decimal/decimal.util';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioCalculationEngine } from '../../domain/calculation/portfolio-calculation.engine';
import { Lot } from '../../domain/calculation/lot';
import {
  CalculationTransaction,
  CalculationTransactionType
} from '../../domain/calculation/types/calculation-transaction.types';
import { CostBasisStrategy } from '../../domain/calculation/types/cost-basis.strategy.enum';
import { PortfolioCalculationCheckpoint } from '../../domain/entities/portfolio-calculation-checkpoint.entity';
import { PortfolioOpeningBalance } from '../../domain/entities/portfolio-opening-balance.entity';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import { PortfolioTransactionType } from '../../domain/enums/portfolio-transaction-type.enum';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { PORTFOLIO_VALUATION_CURRENCY } from '../../domain/portfolio-valuation.constants';
import {
  IGetPortfolioPnlUseCase,
  IPortfolioCalculationCheckpointRepository,
  IPortfolioCalculationEngineFactory,
  IPortfolioOpeningBalanceRepository,
  IPortfolioRepository,
  IPortfolioTransactionRepository,
  PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY,
  PORTFOLIO_CALCULATION_ENGINE,
  PORTFOLIO_OPENING_BALANCE_REPOSITORY,
  PORTFOLIO_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY,
  PortfolioPnlPosition,
  PortfolioPnlResult,
  SaveCheckpointData
} from '../interfaces/portfolio.interface';

/**
 * One asset's transactions grouped with opening-balance and asset metadata.
 * `openingBalanceUpdatedAt` is used to detect whether the opening balance
 * changed since a checkpoint was saved — a stale opening balance invalidates
 * all calculation state for that asset.
 */
interface AssetTransactionGroup {
  assetId: string;
  symbol: string;
  name: string;
  currentPrice: string | null;
  openingQuantity: string;
  openingCost: string;
  openingBalanceUpdatedAt: Date | null;
  transactions: CalculationTransaction[];
}

/**
 * Computes the current P&L of a portfolio on demand.
 *
 * Each asset's calculation is incremental: if a checkpoint exists for
 * (portfolioId, assetId, strategy) and the ledger has not changed at or before
 * the checkpoint boundary, only the suffix of new transactions is processed.
 * Otherwise the full ledger is replayed. The checkpoint is saved after a
 * successful calculation so the next request can resume from the new boundary.
 *
 * Market-price-dependent values (unrealized P&L, current value) are never
 * stored in a checkpoint — they are always derived from asset.currentPrice at
 * request time.
 */
@Injectable()
export class GetPortfolioPnlUseCase implements IGetPortfolioPnlUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_OPENING_BALANCE_REPOSITORY)
    private readonly openingBalanceRepository: IPortfolioOpeningBalanceRepository,
    @Inject(PORTFOLIO_CALCULATION_ENGINE)
    private readonly engineFactory: IPortfolioCalculationEngineFactory,
    @Inject(PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY)
    private readonly checkpointRepository: IPortfolioCalculationCheckpointRepository,
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

    const [transactions, openingBalances] = await Promise.all([
      this.transactionRepository.listForPnl(portfolioId, userId),
      this.openingBalanceRepository.listForPnl(portfolioId, userId)
    ]);

    const engine = this.engineFactory.create(costBasisStrategy);
    const groups = this.groupByAsset(transactions, openingBalances);

    const positions = await Promise.all(
      groups.map((group) =>
        this.calculatePositionIncremental(
          engine,
          group,
          portfolioId,
          costBasisStrategy
        )
      )
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

  /**
   * Calculates one asset position, using a checkpoint to skip already-processed
   * transactions when the ledger has not changed before the checkpoint boundary.
   *
   * Validity rules (a checkpoint is stale and triggers a full replay if any hold):
   *  - No checkpoint exists for this (portfolioId, assetId, strategy) scope.
   *  - The opening balance changed after the checkpoint was saved.
   *  - The checkpoint's lastTransactionId is no longer present in the ledger
   *    (the transaction was deleted — should be prevented by invalidation, but
   *    we guard defensively).
   *
   * After a successful calculation the checkpoint is saved under the asset
   * lock only when the ledger is unchanged (see `saveCheckpointIfCurrent`).
   */
  private async calculatePositionIncremental(
    engine: PortfolioCalculationEngine,
    group: AssetTransactionGroup,
    portfolioId: string,
    strategy: CostBasisStrategy
  ): Promise<PortfolioPnlPosition> {
    const checkpoint = await this.checkpointRepository.findByScope(
      portfolioId,
      group.assetId,
      strategy
    );

    const { position, checkpointData } = this.computePosition(
      engine,
      group,
      portfolioId,
      strategy,
      checkpoint
    );

    // Persist the checkpoint only after re-verifying under the asset lock that
    // the ledger has not changed since the calculation snapshot.
    if (checkpointData !== null) {
      await this.saveCheckpointIfCurrent(group, checkpointData);
    }

    return position;
  }

  /**
   * Saves a checkpoint under the (portfolioId, assetId) advisory lock, but only
   * if the ledger still matches the snapshot the checkpoint was computed from.
   *
   * The lock serializes this save against ledger mutations, so:
   *  - A mutation that commits before the re-read makes the re-read mismatch
   *    and the save is skipped (the mutation already invalidated, or will
   *    invalidate, anything saved earlier).
   *  - A mutation that commits after the save runs its persist-and-invalidate
   *    strictly after it, deleting this checkpoint.
   *
   * Save failures are logged but never break the P&L response.
   */
  private async saveCheckpointIfCurrent(
    group: AssetTransactionGroup,
    checkpointData: SaveCheckpointData
  ): Promise<void> {
    try {
      await this.checkpointRepository.withAssetLock(
        checkpointData.portfolioId,
        checkpointData.assetId,
        async (manager) => {
          const [currentTransactions, currentOpeningBalanceUpdatedAt] =
            await Promise.all([
              this.transactionRepository.listForCheckpoint(
                checkpointData.portfolioId,
                checkpointData.assetId,
                manager
              ),
              this.openingBalanceRepository.findUpdatedAtForCheckpoint(
                checkpointData.portfolioId,
                checkpointData.assetId,
                manager
              )
            ]);

          if (
            this.ledgerMatches(
              group.transactions,
              currentTransactions,
              group.openingBalanceUpdatedAt,
              currentOpeningBalanceUpdatedAt
            )
          ) {
            await this.checkpointRepository.save(checkpointData, manager);
          }
        }
      );
    } catch (err: unknown) {
      this.logger.error(
        {
          err,
          portfolioId: checkpointData.portfolioId,
          assetId: checkpointData.assetId,
          strategy: checkpointData.costBasisStrategy
        },
        'Failed to save P&L checkpoint'
      );
    }
  }

  /**
   * Compares the calculation snapshot against a fresh re-read taken under the
   * asset lock. Any difference — an added, deleted or edited transaction, or a
   * changed opening balance — means the checkpoint is stale and must not be
   * saved.
   */
  private ledgerMatches(
    expected: CalculationTransaction[],
    actual: PortfolioTransaction[],
    expectedOpeningBalanceUpdatedAt: Date | null,
    actualOpeningBalanceUpdatedAt: Date | null
  ): boolean {
    if (expected.length !== actual.length) return false;

    if (
      this.openingBalanceChanged(
        expectedOpeningBalanceUpdatedAt,
        actualOpeningBalanceUpdatedAt
      )
    ) {
      return false;
    }

    for (let i = 0; i < expected.length; i++) {
      const snapshot = expected[i];
      const current = actual[i];
      if (
        current.id !== snapshot.id ||
        this.toCalculationType(current.type) !== snapshot.type ||
        current.amount !== snapshot.amount ||
        (current.price ?? undefined) !== snapshot.price ||
        (current.fee ?? undefined) !== snapshot.fee ||
        current.occurredAt.toISOString() !== snapshot.occurredAt
      ) {
        return false;
      }
    }

    return true;
  }

  private openingBalanceChanged(
    left: Date | null,
    right: Date | null
  ): boolean {
    if (left === null || right === null) return left !== right;
    return left.getTime() !== right.getTime();
  }

  /**
   * Core incremental logic. Returns the computed position and, when the ledger
   * was non-empty, the checkpoint data to persist. Returns `null` for
   * checkpointData when there are no transactions to checkpoint (e.g. the
   * asset only has an opening balance and no transactions yet — checkpointing
   * that state would be vacuous and would not save any future work).
   */
  private computePosition(
    engine: PortfolioCalculationEngine,
    group: AssetTransactionGroup,
    portfolioId: string,
    strategy: CostBasisStrategy,
    checkpoint: PortfolioCalculationCheckpoint | null
  ): {
    position: PortfolioPnlPosition;
    checkpointData: SaveCheckpointData | null;
  } {
    const validCheckpoint = this.resolveCheckpoint(group, checkpoint);

    let allRealizedPnlEvents;
    let engineResult;

    if (validCheckpoint !== null) {
      const suffixStart = validCheckpoint.suffixStart;

      if (suffixStart === group.transactions.length) {
        // No new transactions — reconstruct the position directly from checkpoint.
        engineResult = {
          quantity: checkpoint!.quantity,
          totalCost: checkpoint!.totalCost,
          averageCost: '0', // derived below after we have quantity
          realizedPnl: checkpoint!.realizedPnlEvents,
          lots: checkpoint!.lots ?? undefined
        };
        allRealizedPnlEvents = checkpoint!.realizedPnlEvents;
      } else {
        // Process only the suffix. For lot-based strategies, the checkpoint's
        // lot queue must be passed through the opening state so disposal order
        // is preserved exactly.
        const suffix = group.transactions.slice(suffixStart);
        const resumeResult = engine.calculate(
          {
            assetId: group.assetId,
            openingQuantity: checkpoint!.quantity,
            openingCost: checkpoint!.totalCost,
            openingLots: checkpoint!.lots ?? undefined,
            transactions: suffix
          } as any,
          { alreadyOrdered: true, trustedIsoDates: true }
        );
        allRealizedPnlEvents = [
          ...checkpoint!.realizedPnlEvents,
          ...resumeResult.realizedPnl
        ];
        engineResult = { ...resumeResult, realizedPnl: allRealizedPnlEvents };
      }
    } else {
      // Full replay.
      const fullResult = engine.calculate(
        {
          assetId: group.assetId,
          openingQuantity: group.openingQuantity,
          openingCost: group.openingCost,
          transactions: group.transactions
        },
        { alreadyOrdered: true, trustedIsoDates: true }
      );
      allRealizedPnlEvents = fullResult.realizedPnl;
      engineResult = fullResult;
    }

    const position = this.buildPosition(
      group,
      engineResult,
      allRealizedPnlEvents
    );

    // Build checkpoint data if there is at least one transaction to anchor on.
    let checkpointData: SaveCheckpointData | null = null;
    if (group.transactions.length > 0) {
      const last = group.transactions[group.transactions.length - 1];
      checkpointData = {
        portfolioId,
        assetId: group.assetId,
        costBasisStrategy: strategy,
        lastTransactionId: last.id!,
        lastTransactionOccurredAt: last.occurredAt,
        quantity: engineResult.quantity,
        totalCost: engineResult.totalCost,
        lots: engineResult.lots ?? null,
        realizedPnlEvents: allRealizedPnlEvents,
        openingBalanceUpdatedAt: group.openingBalanceUpdatedAt ?? null
      };
    }

    return { position, checkpointData };
  }

  /**
   * Determines whether an existing checkpoint is valid for incremental use.
   *
   * Returns `{ suffixStart }` (index into `group.transactions` of the first
   * unprocessed transaction) when the checkpoint is valid, or `null` when the
   * full ledger must be replayed.
   *
   * A checkpoint is invalid if:
   * - It does not exist.
   * - The opening balance changed (different updatedAt timestamp).
   * - The checkpoint's lastTransactionId is absent from the current ledger
   *   (defensive: should already be evicted by the delete-invalidation hook).
   */
  private resolveCheckpoint(
    group: AssetTransactionGroup,
    checkpoint: PortfolioCalculationCheckpoint | null
  ): { suffixStart: number } | null {
    if (checkpoint === null) return null;

    // Opening balance staleness check.
    const cpObAt = checkpoint.openingBalanceUpdatedAt;
    const grObAt = group.openingBalanceUpdatedAt;
    if (cpObAt === null || grObAt === null) {
      if (cpObAt !== grObAt) return null;
    } else if (cpObAt.getTime() !== grObAt.getTime()) {
      return null;
    }

    // Locate the last-processed transaction in the current ordered ledger.
    const lastIdx = group.transactions.findIndex(
      (tx) => tx.id === checkpoint.lastTransactionId
    );
    if (lastIdx === -1) {
      // Checkpoint refers to a deleted transaction — full replay.
      return null;
    }

    return { suffixStart: lastIdx + 1 };
  }

  private buildPosition(
    group: AssetTransactionGroup,
    result: {
      quantity: string;
      totalCost: string;
      averageCost?: string;
      realizedPnl: unknown[];
      lots?: Lot[];
    },
    allRealizedPnlEvents: ReturnType<
      PortfolioCalculationEngine['calculate']
    >['realizedPnl']
  ): PortfolioPnlPosition {
    const realizedPnl = this.sumSigned(
      allRealizedPnlEvents.map((event) => event.realizedPnl)
    );

    let currentValue: string | null = null;
    let unrealizedPnl: string | null = null;
    let totalPnl: string | null = null;

    if (group.currentPrice !== null) {
      currentValue = multiplyDecimals(result.quantity, group.currentPrice);
      unrealizedPnl = subtractDecimals(currentValue, result.totalCost);
      totalPnl = this.addSignedDecimals(realizedPnl, unrealizedPnl);
    }

    // averageCost is always derived fresh — never stored in a checkpoint.
    const { averageCost } = this.engineFactory
      .create(CostBasisStrategy.AVERAGE)
      .calculate(
        {
          assetId: group.assetId,
          openingQuantity: result.quantity,
          openingCost: result.totalCost,
          transactions: []
        },
        { alreadyOrdered: true, trustedIsoDates: true }
      );

    return {
      assetId: group.assetId,
      symbol: group.symbol,
      name: group.name,
      quantity: result.quantity,
      totalCost: result.totalCost,
      averageCost,
      currentPrice: group.currentPrice,
      currentValue,
      realizedPnl,
      unrealizedPnl,
      totalPnl,
      realizedPnlEvents: allRealizedPnlEvents
    };
  }

  private groupByAsset(
    transactions: PortfolioTransaction[],
    openingBalances: PortfolioOpeningBalance[]
  ): AssetTransactionGroup[] {
    const groups = new Map<string, AssetTransactionGroup>();

    for (const openingBalance of openingBalances) {
      const asset = openingBalance.asset;
      groups.set(openingBalance.assetId, {
        assetId: openingBalance.assetId,
        symbol: asset.symbol,
        name: asset.name,
        currentPrice: asset.currentPrice,
        openingQuantity: openingBalance.openingQuantity,
        openingCost: openingBalance.openingCost,
        openingBalanceUpdatedAt: openingBalance.updatedAt,
        transactions: []
      });
    }

    for (const transaction of transactions) {
      let group = groups.get(transaction.assetId);

      if (!group) {
        const asset = transaction.asset;
        group = {
          assetId: transaction.assetId,
          symbol: asset.symbol,
          name: asset.name,
          currentPrice: asset.currentPrice,
          openingQuantity: '0',
          openingCost: '0',
          openingBalanceUpdatedAt: null,
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
