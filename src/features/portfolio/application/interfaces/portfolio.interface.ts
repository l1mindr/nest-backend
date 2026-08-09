import { Holding } from '../../domain/entities/holding.entity';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import { PortfolioSourceType } from '../../domain/enums/portfolio-source-type.enum';
import { PortfolioTransactionType } from '../../domain/enums/portfolio-transaction-type.enum';
import { PortfolioValuationStatus } from '../../domain/enums/portfolio-valuation-status.enum';
import { CreateHoldingRequestDto } from '../../presentation/dto/request/create-holding.request.dto';
import { CreatePortfolioRequestDto } from '../../presentation/dto/request/create-portfolio.request.dto';
import { CreatePortfolioTransactionRequestDto } from '../../presentation/dto/request/create-portfolio-transaction.request.dto';
import { PortfolioTransactionListRequestDto } from '../../presentation/dto/request/portfolio-transaction-list.request.dto';
import { UpdateHoldingRequestDto } from '../../presentation/dto/request/update-holding.request.dto';

export const PORTFOLIO_REPOSITORY = Symbol('IPortfolioRepository');

export interface CreatePortfolioData {
  userId: string;
  name: string;
  sourceType: PortfolioSourceType;
  walletAddress: string | null;
}

export interface IPortfolioRepository {
  create(data: CreatePortfolioData): Promise<Portfolio>;
  findByIdAndUser(id: string, userId: string): Promise<Portfolio | null>;
  findByUserId(userId: string): Promise<Portfolio[]>;
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

export interface IListHoldingsUseCase {
  execute(
    userId: string,
    options: { portfolioId?: string }
  ): Promise<Holding[]>;
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
  create(data: CreatePortfolioTransactionData): Promise<PortfolioTransaction>;
  findByIdAndPortfolioAndUser(
    id: string,
    portfolioId: string,
    userId: string
  ): Promise<PortfolioTransaction | null>;
  listByPortfolioAndUser(
    filter: ListPortfolioTransactionsFilter
  ): Promise<PortfolioTransaction[]>;
  deleteByIdAndPortfolioAndUser(
    id: string,
    portfolioId: string,
    userId: string
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
