import { Holding } from '../../domain/entities/holding.entity';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import { PortfolioSourceType } from '../../domain/enums/portfolio-source-type.enum';
import { CreateHoldingRequestDto } from '../../presentation/dto/request/create-holding.request.dto';
import { CreatePortfolioRequestDto } from '../../presentation/dto/request/create-portfolio.request.dto';
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
