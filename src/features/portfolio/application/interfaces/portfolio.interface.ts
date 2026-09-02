import { Asset } from '@features/assets/domain/entities/asset.entity';
import { PortfolioCalculationEngine } from '../../domain/calculation/portfolio-calculation.engine';
import { Lot } from '../../domain/calculation/lot';
import { RealizedPnlEvent } from '../../domain/calculation/types/calculation-result.types';
import { CostBasisStrategy } from '../../domain/calculation/types/cost-basis.strategy.enum';
import { Holding } from '../../domain/entities/holding.entity';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import { PortfolioCalculationCheckpoint } from '../../domain/entities/portfolio-calculation-checkpoint.entity';
import { PortfolioOpeningBalance } from '../../domain/entities/portfolio-opening-balance.entity';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import { PortfolioSourceType } from '../../domain/enums/portfolio-source-type.enum';
import { PortfolioTransactionType } from '../../domain/enums/portfolio-transaction-type.enum';
import { PortfolioValuationStatus } from '../../domain/enums/portfolio-valuation-status.enum';
import { CreateHoldingRequestDto } from '../../presentation/dto/request/create-holding.request.dto';
import { CreatePortfolioRequestDto } from '../../presentation/dto/request/create-portfolio.request.dto';
import { CreatePortfolioTransactionRequestDto } from '../../presentation/dto/request/create-portfolio-transaction.request.dto';
import { PortfolioTransactionListRequestDto } from '../../presentation/dto/request/portfolio-transaction-list.request.dto';
import { UpdateHoldingRequestDto } from '../../presentation/dto/request/update-holding.request.dto';
import { UpdatePortfolioRequestDto } from '../../presentation/dto/request/update-portfolio.request.dto';
import { UpdatePortfolioTransactionRequestDto } from '../../presentation/dto/request/update-portfolio-transaction.request.dto';
import { SetPortfolioOpeningBalanceRequestDto } from '../../presentation/dto/request/set-portfolio-opening-balance.request.dto';
import type { EntityManager } from 'typeorm';

export const PORTFOLIO_REPOSITORY = Symbol('IPortfolioRepository');

export interface CreatePortfolioData {
  userId: string;
  name: string;
  sourceType: PortfolioSourceType;
  walletAddress: string | null;
}

export interface UpdatePortfolioData {
  name?: string;
  sourceType?: PortfolioSourceType;
  walletAddress?: string | null;
}

export interface IPortfolioRepository {
  create(data: CreatePortfolioData): Promise<Portfolio>;
  findByIdAndUser(id: string, userId: string): Promise<Portfolio | null>;
  findByUserId(userId: string): Promise<Portfolio[]>;
  update(
    id: string,
    userId: string,
    data: UpdatePortfolioData
  ): Promise<Portfolio | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export const HOLDING_REPOSITORY = Symbol('IHoldingRepository');

export interface CreateHoldingData {
  userId: string;
  portfolioId: string;
  assetId: string;
  amount: string;
  notes: string | null;
}

export interface UpdateHoldingData {
  amount?: string;
  notes?: string | null;
}

export interface IHoldingRepository {
  create(data: CreateHoldingData): Promise<Holding>;
  findByIdAndUser(id: string, userId: string): Promise<Holding | null>;
  findByPortfolioAndAsset(
    portfolioId: string,
    assetId: string
  ): Promise<Holding | null>;
  listByUser(
    userId: string,
    options: { portfolioId?: string }
  ): Promise<Holding[]>;
  listForValuation(portfolioId: string): Promise<Holding[]>;
  update(
    id: string,
    userId: string,
    data: UpdateHoldingData
  ): Promise<Holding | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface ICreatePortfolioUseCase {
  execute(userId: string, dto: CreatePortfolioRequestDto): Promise<Portfolio>;
}

export const CREATE_PORTFOLIO_USE_CASE = Symbol('ICreatePortfolioUseCase');

export interface IListPortfoliosUseCase {
  execute(userId: string): Promise<Portfolio[]>;
}

export const LIST_PORTFOLIOS_USE_CASE = Symbol('IListPortfoliosUseCase');

export interface IGetPortfolioUseCase {
  execute(userId: string, portfolioId: string): Promise<Portfolio>;
}

export const GET_PORTFOLIO_USE_CASE = Symbol('IGetPortfolioUseCase');

export interface IUpdatePortfolioUseCase {
  execute(
    portfolioId: string,
    userId: string,
    dto: UpdatePortfolioRequestDto
  ): Promise<Portfolio>;
}

export const UPDATE_PORTFOLIO_USE_CASE = Symbol('IUpdatePortfolioUseCase');

export interface IDeletePortfolioUseCase {
  execute(portfolioId: string, userId: string): Promise<void>;
}

export const DELETE_PORTFOLIO_USE_CASE = Symbol('IDeletePortfolioUseCase');

export const PORTFOLIO_OPENING_BALANCE_REPOSITORY = Symbol(
  'IPortfolioOpeningBalanceRepository'
);

export interface SetPortfolioOpeningBalanceData {
  userId: string;
  portfolioId: string;
  assetId: string;
  openingQuantity: string;
  openingCost: string;
}

export interface IPortfolioOpeningBalanceRepository {
  upsert(
    data: SetPortfolioOpeningBalanceData,
    manager?: EntityManager
  ): Promise<PortfolioOpeningBalance>;
  listByPortfolioAndUser(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioOpeningBalance[]>;
  listForPnl(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioOpeningBalance[]>;
  /**
   * Re-reads the opening-balance row for one asset inside an asset lock so the
   * P&L use case can verify a checkpoint's opening-balance anchor is current.
   * Returns null when no opening balance exists for the scope.
   */
  findUpdatedAtForCheckpoint(
    portfolioId: string,
    assetId: string,
    manager: EntityManager
  ): Promise<Date | null>;
}

export interface ISetPortfolioOpeningBalanceUseCase {
  execute(
    userId: string,
    portfolioId: string,
    assetId: string,
    dto: SetPortfolioOpeningBalanceRequestDto
  ): Promise<PortfolioOpeningBalance>;
}

export const SET_PORTFOLIO_OPENING_BALANCE_USE_CASE = Symbol(
  'ISetPortfolioOpeningBalanceUseCase'
);

export interface IListPortfolioOpeningBalancesUseCase {
  execute(
    userId: string,
    portfolioId: string
  ): Promise<PortfolioOpeningBalance[]>;
}

export const LIST_PORTFOLIO_OPENING_BALANCES_USE_CASE = Symbol(
  'IListPortfolioOpeningBalancesUseCase'
);

export interface ICreateHoldingUseCase {
  execute(userId: string, dto: CreateHoldingRequestDto): Promise<Holding>;
}

export const CREATE_HOLDING_USE_CASE = Symbol('ICreateHoldingUseCase');

export interface IUpdateHoldingUseCase {
  execute(
    holdingId: string,
    userId: string,
    dto: UpdateHoldingRequestDto
  ): Promise<Holding>;
}

export const UPDATE_HOLDING_USE_CASE = Symbol('IUpdateHoldingUseCase');

export interface IDeleteHoldingUseCase {
  execute(holdingId: string, userId: string): Promise<void>;
}

export const DELETE_HOLDING_USE_CASE = Symbol('IDeleteHoldingUseCase');

/**
 * One asset position derived from the transaction ledger.
 *
 * Carries the same fields as a `holding` row so it maps to the unchanged
 * holdings response, but nothing here is persisted.
 */
export interface DerivedHolding {
  id: string;
  portfolioId: string;
  assetId: string;
  amount: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset: Asset;
}

export interface IListHoldingsUseCase {
  execute(
    userId: string,
    options: { portfolioId?: string }
  ): Promise<DerivedHolding[]>;
}

export const LIST_HOLDINGS_USE_CASE = Symbol('IListHoldingsUseCase');

export interface PortfolioHoldingValuation {
  holdingId: string;
  assetId: string;
  symbol: string;
  name: string;
  amount: string;
  currentPrice: string | null;
  value: string | null;
}

export interface PortfolioValuation {
  portfolioId: string;
  currency: string;
  totalValue: string | null;
  status: PortfolioValuationStatus;
  valuedHoldings: number;
  unvaluedHoldings: number;
  holdings: PortfolioHoldingValuation[];
}

export interface IGetPortfolioValuationUseCase {
  execute(userId: string, portfolioId: string): Promise<PortfolioValuation>;
}

export const GET_PORTFOLIO_VALUATION_USE_CASE = Symbol(
  'IGetPortfolioValuationUseCase'
);

/**
 * Builds a portfolio calculation engine configured with a cost-basis strategy.
 *
 * The engine fixes its strategy at construction time, so the strategy must be
 * chosen per request. The use case depends on this abstraction instead of
 * constructing engines itself; the provider is the single place that decides
 * how an engine is built.
 */
export const PORTFOLIO_CALCULATION_ENGINE = Symbol(
  'IPortfolioCalculationEngineFactory'
);

export interface IPortfolioCalculationEngineFactory {
  create(strategy: CostBasisStrategy): PortfolioCalculationEngine;
}

export const PORTFOLIO_TRANSACTION_REPOSITORY = Symbol(
  'IPortfolioTransactionRepository'
);

export interface CreatePortfolioTransactionData {
  userId: string;
  portfolioId: string;
  assetId: string;
  type: PortfolioTransactionType;
  amount: string;
  price: string | null;
  fee: string | null;
  occurredAt: Date;
  notes: string | null;
}

export interface UpdatePortfolioTransactionData {
  type?: PortfolioTransactionType;
  amount?: string;
  price?: string | null;
  fee?: string | null;
  occurredAt?: Date;
  notes?: string | null;
}

/**
 * A decoded transaction cursor: the keyset boundary the next page must start
 * strictly after, when sorting by `occurredAt` then `id`, both descending.
 */
export interface PortfolioTransactionCursor {
  occurredAt: Date;
  id: string;
}

export interface ListPortfolioTransactionsFilter {
  userId: string;
  portfolioId: string;
  assetId?: string;
  type?: PortfolioTransactionType;
  from?: Date;
  to?: Date;
  cursor?: PortfolioTransactionCursor | null;
  limit: number;
}

export interface IPortfolioTransactionRepository {
  create(
    data: CreatePortfolioTransactionData,
    manager?: EntityManager
  ): Promise<PortfolioTransaction>;
  findByIdAndPortfolioAndUser(
    id: string,
    portfolioId: string,
    userId: string
  ): Promise<PortfolioTransaction | null>;
  listByPortfolioAndUser(
    filter: ListPortfolioTransactionsFilter
  ): Promise<PortfolioTransaction[]>;
  /**
   * Loads the complete transaction ledger of one portfolio with the asset
   * resolved inline, for P&L calculation. Never paginated: the calculation
   * engine requires the full chronological stream. Ordered by `occurredAt`
   * ASC then `id` ASC; the trusted P&L path consumes this ordering unchanged.
   */
  listForPnl(
    portfolioId: string,
    userId: string
  ): Promise<PortfolioTransaction[]>;
  /**
   * Re-reads one asset's full ledger inside an asset lock so the P&L use case
   * can verify a checkpoint still reflects the current ledger before saving.
   * Ordered exactly like `listForPnl` (occurredAt ASC, id ASC) so the result
   * can be compared element-wise with the already-grouped calculation stream.
   */
  listForCheckpoint(
    portfolioId: string,
    assetId: string,
    manager: EntityManager
  ): Promise<PortfolioTransaction[]>;
  /**
   * Get all transactions for a specific asset in chronological order.
   * Used for holdings calculations and validation.
   * Ordered by occurredAt ASC, id ASC.
   */
  listByPortfolioAndAsset(
    portfolioId: string,
    assetId: string,
    userId: string
  ): Promise<PortfolioTransaction[]>;
  update(
    id: string,
    portfolioId: string,
    userId: string,
    data: UpdatePortfolioTransactionData,
    manager?: EntityManager
  ): Promise<PortfolioTransaction | null>;
  deleteByIdAndPortfolioAndUser(
    id: string,
    portfolioId: string,
    userId: string,
    manager?: EntityManager
  ): Promise<boolean>;
}

export interface ICreatePortfolioTransactionUseCase {
  execute(
    userId: string,
    portfolioId: string,
    dto: CreatePortfolioTransactionRequestDto
  ): Promise<PortfolioTransaction>;
}

export const CREATE_PORTFOLIO_TRANSACTION_USE_CASE = Symbol(
  'ICreatePortfolioTransactionUseCase'
);

export interface IListPortfolioTransactionsUseCase {
  execute(
    userId: string,
    portfolioId: string,
    query: PortfolioTransactionListRequestDto
  ): Promise<PaginatedTransactions>;
}

export const LIST_PORTFOLIO_TRANSACTIONS_USE_CASE = Symbol(
  'IListPortfolioTransactionsUseCase'
);

export interface PaginatedTransactions {
  items: PortfolioTransaction[];
  nextCursor: string | null;
}

export interface IGetPortfolioTransactionUseCase {
  execute(
    userId: string,
    portfolioId: string,
    transactionId: string
  ): Promise<PortfolioTransaction>;
}

export const GET_PORTFOLIO_TRANSACTION_USE_CASE = Symbol(
  'IGetPortfolioTransactionUseCase'
);

export interface IDeletePortfolioTransactionUseCase {
  execute(
    userId: string,
    portfolioId: string,
    transactionId: string
  ): Promise<void>;
}

export const DELETE_PORTFOLIO_TRANSACTION_USE_CASE = Symbol(
  'IDeletePortfolioTransactionUseCase'
);

export interface IUpdatePortfolioTransactionUseCase {
  execute(
    userId: string,
    portfolioId: string,
    transactionId: string,
    dto: UpdatePortfolioTransactionRequestDto
  ): Promise<PortfolioTransaction>;
}

export const UPDATE_PORTFOLIO_TRANSACTION_USE_CASE = Symbol(
  'IUpdatePortfolioTransactionUseCase'
);

/**
 * One asset position in a portfolio P&L calculation.
 *
 * All monetary and quantity values are exact decimal strings; `null` marks a
 * value that cannot be computed because the asset has no current price.
 */
export interface PortfolioPnlPosition {
  assetId: string;
  symbol: string;
  name: string;
  quantity: string;
  totalCost: string;
  averageCost: string;
  currentPrice: string | null;
  currentValue: string | null;
  realizedPnl: string;
  unrealizedPnl: string | null;
  totalPnl: string | null;
  realizedPnlEvents: RealizedPnlEvent[];
}

/**
 * The application-facing result of a portfolio P&L calculation.
 *
 * When any position is unpriced, `totalCurrentValue`, `totalUnrealizedPnl`
 * and `totalPnl` are `null`; `totalRealizedPnl` never needs a market price
 * and is always present.
 */
export interface PortfolioPnlResult {
  portfolioId: string;
  currency: string;
  costBasisStrategy: CostBasisStrategy;
  pricedPositions: number;
  unpricedPositions: number;
  totalCurrentValue: string | null;
  totalCostBasis: string;
  totalRealizedPnl: string;
  totalUnrealizedPnl: string | null;
  totalPnl: string | null;
  positions: PortfolioPnlPosition[];
}

export interface IGetPortfolioPnlUseCase {
  execute(
    userId: string,
    portfolioId: string,
    strategy?: CostBasisStrategy
  ): Promise<PortfolioPnlResult>;
}

export const GET_PORTFOLIO_PNL_USE_CASE = Symbol('IGetPortfolioPnlUseCase');

export const PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY = Symbol(
  'IPortfolioCalculationCheckpointRepository'
);

/**
 * The data needed to save or replace a checkpoint.
 */
export interface SaveCheckpointData {
  portfolioId: string;
  assetId: string;
  costBasisStrategy: CostBasisStrategy;
  lastTransactionId: string;
  lastTransactionOccurredAt: string;
  quantity: string;
  totalCost: string;
  lots: Lot[] | null;
  realizedPnlEvents: RealizedPnlEvent[];
  openingBalanceUpdatedAt: Date | null;
}

export interface IPortfolioCalculationCheckpointRepository {
  /**
   * Runs `work` inside a transaction that holds a PostgreSQL advisory lock
   * scoped to (portfolioId, assetId). Every mutation of that asset's ledger
   * (transaction create/update/delete, opening-balance change) runs its
   * persist-and-invalidate inside this lock, and the P&L use case saves a
   * checkpoint only after re-verifying the ledger under the same lock. This
   * serializes ledger writes against checkpoint writes so a checkpoint can
   * never be persisted from a ledger snapshot that a concurrent mutation has
   * already made stale.
   */
  withAssetLock<T>(
    portfolioId: string,
    assetId: string,
    work: (manager: EntityManager) => Promise<T>
  ): Promise<T>;

  /**
   * Returns the checkpoint for the given scope, or null if none exists.
   */
  findByScope(
    portfolioId: string,
    assetId: string,
    strategy: CostBasisStrategy
  ): Promise<PortfolioCalculationCheckpoint | null>;

  /**
   * Upserts the checkpoint for the given scope (insert or replace on
   * the unique (portfolioId, assetId, costBasisStrategy) key).
   */
  save(data: SaveCheckpointData, manager?: EntityManager): Promise<void>;

  /**
   * Deletes all checkpoints for the given (portfolioId, assetId) pair across
   * all strategies. Called on any transaction or opening-balance mutation.
   */
  deleteByPortfolioAndAsset(
    portfolioId: string,
    assetId: string,
    manager?: EntityManager
  ): Promise<void>;

  /**
   * Deletes all checkpoints for a portfolio (e.g. on portfolio deletion).
   */
  deleteByPortfolio(
    portfolioId: string,
    manager?: EntityManager
  ): Promise<void>;
}
