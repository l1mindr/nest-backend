import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '@features/assets/domain/entities/asset.entity';
import { AssetsModule } from '@features/assets/assets.module';
import { Portfolio } from './domain/entities/portfolio.entity';
import { Holding } from './domain/entities/holding.entity';
import { PortfolioTransaction } from './domain/entities/portfolio-transaction.entity';
import { PortfolioOpeningBalance } from './domain/entities/portfolio-opening-balance.entity';
import { PortfolioCalculationCheckpoint } from './domain/entities/portfolio-calculation-checkpoint.entity';
import { PortfolioRepository } from './infrastructure/repositories/portfolio.repository';
import { HoldingRepository } from './infrastructure/repositories/holding.repository';
import { PortfolioTransactionRepository } from './infrastructure/repositories/portfolio-transaction.repository';
import { PortfolioOpeningBalanceRepository } from './infrastructure/repositories/portfolio-opening-balance.repository';
import { PortfolioCalculationCheckpointRepository } from './infrastructure/repositories/portfolio-calculation-checkpoint.repository';
import { CreatePortfolioUseCase } from './application/use-cases/create-portfolio.use-case';
import { GetPortfolioUseCase } from './application/use-cases/get-portfolio.use-case';
import { GetPortfolioValuationUseCase } from './application/use-cases/get-portfolio-valuation.use-case';
import { GetPortfolioPnlUseCase } from './application/use-cases/get-portfolio-pnl.use-case';
import { ListPortfoliosUseCase } from './application/use-cases/list-portfolios.use-case';
import { UpdatePortfolioUseCase } from './application/use-cases/update-portfolio.use-case';
import { DeletePortfolioUseCase } from './application/use-cases/delete-portfolio.use-case';
import { CreateHoldingUseCase } from './application/use-cases/create-holding.use-case';
import { UpdateHoldingUseCase } from './application/use-cases/update-holding.use-case';
import { DeleteHoldingUseCase } from './application/use-cases/delete-holding.use-case';
import { ListHoldingsUseCase } from './application/use-cases/list-holdings.use-case';
import { CreatePortfolioTransactionUseCase } from './application/use-cases/create-portfolio-transaction.use-case';
import { ListPortfolioTransactionsUseCase } from './application/use-cases/list-portfolio-transactions.use-case';
import { GetPortfolioTransactionUseCase } from './application/use-cases/get-portfolio-transaction.use-case';
import { UpdatePortfolioTransactionUseCase } from './application/use-cases/update-portfolio-transaction.use-case';
import { DeletePortfolioTransactionUseCase } from './application/use-cases/delete-portfolio-transaction.use-case';
import { SetPortfolioOpeningBalanceUseCase } from './application/use-cases/set-portfolio-opening-balance.use-case';
import { ListPortfolioOpeningBalancesUseCase } from './application/use-cases/list-portfolio-opening-balances.use-case';
import { PortfolioMapper } from './application/mappers/portfolio.mapper';
import { PortfolioValuationMapper } from './application/mappers/portfolio-valuation.mapper';
import { PortfolioPnlMapper } from './application/mappers/portfolio-pnl.mapper';
import { HoldingMapper } from './application/mappers/holding.mapper';
import { PortfolioTransactionMapper } from './application/mappers/portfolio-transaction.mapper';
import { PortfolioOpeningBalanceMapper } from './application/mappers/portfolio-opening-balance.mapper';
import { PortfoliosController } from './presentation/controllers/portfolios.controller';
import { HoldingsController } from './presentation/controllers/holdings.controller';
import { PortfolioTransactionsController } from './presentation/controllers/portfolio-transactions.controller';
import { PortfolioPnlController } from './presentation/controllers/portfolio-pnl.controller';
import { PortfolioOpeningBalancesController } from './presentation/controllers/portfolio-opening-balances.controller';
import { PortfolioCalculationEngine } from './domain/calculation/portfolio-calculation.engine';
import { CostBasisStrategy } from './domain/calculation/types/cost-basis.strategy.enum';
import {
  CREATE_HOLDING_USE_CASE,
  CREATE_PORTFOLIO_TRANSACTION_USE_CASE,
  CREATE_PORTFOLIO_USE_CASE,
  DELETE_HOLDING_USE_CASE,
  DELETE_PORTFOLIO_TRANSACTION_USE_CASE,
  DELETE_PORTFOLIO_USE_CASE,
  GET_PORTFOLIO_USE_CASE,
  GET_PORTFOLIO_VALUATION_USE_CASE,
  GET_PORTFOLIO_PNL_USE_CASE,
  GET_PORTFOLIO_TRANSACTION_USE_CASE,
  HOLDING_REPOSITORY,
  IPortfolioCalculationEngineFactory,
  LIST_HOLDINGS_USE_CASE,
  LIST_PORTFOLIO_OPENING_BALANCES_USE_CASE,
  LIST_PORTFOLIO_TRANSACTIONS_USE_CASE,
  LIST_PORTFOLIOS_USE_CASE,
  PORTFOLIO_CALCULATION_ENGINE,
  PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY,
  PORTFOLIO_OPENING_BALANCE_REPOSITORY,
  PORTFOLIO_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY,
  SET_PORTFOLIO_OPENING_BALANCE_USE_CASE,
  UPDATE_HOLDING_USE_CASE,
  UPDATE_PORTFOLIO_USE_CASE,
  UPDATE_PORTFOLIO_TRANSACTION_USE_CASE
} from './application/interfaces/portfolio.interface';

@Module({
  imports: [
    AssetsModule,
    TypeOrmModule.forFeature([
      Portfolio,
      Holding,
      PortfolioTransaction,
      PortfolioOpeningBalance,
      PortfolioCalculationCheckpoint,
      Asset
    ])
  ],
  controllers: [
    PortfoliosController,
    HoldingsController,
    PortfolioTransactionsController,
    PortfolioPnlController,
    PortfolioOpeningBalancesController
  ],
  providers: [
    PortfolioRepository,
    { provide: PORTFOLIO_REPOSITORY, useExisting: PortfolioRepository },
    HoldingRepository,
    { provide: HOLDING_REPOSITORY, useExisting: HoldingRepository },
    PortfolioTransactionRepository,
    {
      provide: PORTFOLIO_TRANSACTION_REPOSITORY,
      useExisting: PortfolioTransactionRepository
    },
    PortfolioOpeningBalanceRepository,
    {
      provide: PORTFOLIO_OPENING_BALANCE_REPOSITORY,
      useExisting: PortfolioOpeningBalanceRepository
    },
    PortfolioCalculationCheckpointRepository,
    {
      provide: PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY,
      useExisting: PortfolioCalculationCheckpointRepository
    },
    CreatePortfolioUseCase,
    { provide: CREATE_PORTFOLIO_USE_CASE, useExisting: CreatePortfolioUseCase },
    GetPortfolioUseCase,
    { provide: GET_PORTFOLIO_USE_CASE, useExisting: GetPortfolioUseCase },
    GetPortfolioValuationUseCase,
    {
      provide: GET_PORTFOLIO_VALUATION_USE_CASE,
      useExisting: GetPortfolioValuationUseCase
    },
    GetPortfolioPnlUseCase,
    {
      provide: GET_PORTFOLIO_PNL_USE_CASE,
      useExisting: GetPortfolioPnlUseCase
    },
    {
      provide: PORTFOLIO_CALCULATION_ENGINE,
      useFactory: (): IPortfolioCalculationEngineFactory => ({
        create: (strategy: CostBasisStrategy) =>
          new PortfolioCalculationEngine(strategy)
      })
    },
    ListPortfoliosUseCase,
    { provide: LIST_PORTFOLIOS_USE_CASE, useExisting: ListPortfoliosUseCase },
    UpdatePortfolioUseCase,
    { provide: UPDATE_PORTFOLIO_USE_CASE, useExisting: UpdatePortfolioUseCase },
    DeletePortfolioUseCase,
    { provide: DELETE_PORTFOLIO_USE_CASE, useExisting: DeletePortfolioUseCase },
    CreateHoldingUseCase,
    { provide: CREATE_HOLDING_USE_CASE, useExisting: CreateHoldingUseCase },
    UpdateHoldingUseCase,
    { provide: UPDATE_HOLDING_USE_CASE, useExisting: UpdateHoldingUseCase },
    DeleteHoldingUseCase,
    { provide: DELETE_HOLDING_USE_CASE, useExisting: DeleteHoldingUseCase },
    ListHoldingsUseCase,
    { provide: LIST_HOLDINGS_USE_CASE, useExisting: ListHoldingsUseCase },
    CreatePortfolioTransactionUseCase,
    {
      provide: CREATE_PORTFOLIO_TRANSACTION_USE_CASE,
      useExisting: CreatePortfolioTransactionUseCase
    },
    ListPortfolioTransactionsUseCase,
    {
      provide: LIST_PORTFOLIO_TRANSACTIONS_USE_CASE,
      useExisting: ListPortfolioTransactionsUseCase
    },
    GetPortfolioTransactionUseCase,
    {
      provide: GET_PORTFOLIO_TRANSACTION_USE_CASE,
      useExisting: GetPortfolioTransactionUseCase
    },
    UpdatePortfolioTransactionUseCase,
    {
      provide: UPDATE_PORTFOLIO_TRANSACTION_USE_CASE,
      useExisting: UpdatePortfolioTransactionUseCase
    },
    DeletePortfolioTransactionUseCase,
    {
      provide: DELETE_PORTFOLIO_TRANSACTION_USE_CASE,
      useExisting: DeletePortfolioTransactionUseCase
    },
    SetPortfolioOpeningBalanceUseCase,
    {
      provide: SET_PORTFOLIO_OPENING_BALANCE_USE_CASE,
      useExisting: SetPortfolioOpeningBalanceUseCase
    },
    ListPortfolioOpeningBalancesUseCase,
    {
      provide: LIST_PORTFOLIO_OPENING_BALANCES_USE_CASE,
      useExisting: ListPortfolioOpeningBalancesUseCase
    },
    PortfolioMapper,
    PortfolioValuationMapper,
    PortfolioPnlMapper,
    HoldingMapper,
    PortfolioTransactionMapper,
    PortfolioOpeningBalanceMapper
  ]
})
export class PortfolioModule {}
