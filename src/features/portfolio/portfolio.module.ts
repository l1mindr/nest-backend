import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '@features/assets/domain/entities/asset.entity';
import { AssetsModule } from '@features/assets/assets.module';
import { Portfolio } from './domain/entities/portfolio.entity';
import { Holding } from './domain/entities/holding.entity';
import { PortfolioRepository } from './infrastructure/repositories/portfolio.repository';
import { HoldingRepository } from './infrastructure/repositories/holding.repository';
import { CreatePortfolioUseCase } from './application/use-cases/create-portfolio.use-case';
import { GetPortfolioUseCase } from './application/use-cases/get-portfolio.use-case';
import { ListPortfoliosUseCase } from './application/use-cases/list-portfolios.use-case';
import { CreateHoldingUseCase } from './application/use-cases/create-holding.use-case';
import { UpdateHoldingUseCase } from './application/use-cases/update-holding.use-case';
import { DeleteHoldingUseCase } from './application/use-cases/delete-holding.use-case';
import { ListHoldingsUseCase } from './application/use-cases/list-holdings.use-case';
import { PortfolioMapper } from './application/mappers/portfolio.mapper';
import { HoldingMapper } from './application/mappers/holding.mapper';
import { PortfoliosController } from './presentation/controllers/portfolios.controller';
import { HoldingsController } from './presentation/controllers/holdings.controller';
import {
  CREATE_HOLDING_USE_CASE,
  CREATE_PORTFOLIO_USE_CASE,
  DELETE_HOLDING_USE_CASE,
  GET_PORTFOLIO_USE_CASE,
  HOLDING_REPOSITORY,
  LIST_HOLDINGS_USE_CASE,
  LIST_PORTFOLIOS_USE_CASE,
  PORTFOLIO_REPOSITORY,
  UPDATE_HOLDING_USE_CASE
} from './application/interfaces/portfolio.interface';

@Module({
  imports: [
    AssetsModule,
    TypeOrmModule.forFeature([Portfolio, Holding, Asset])
  ],
  controllers: [PortfoliosController, HoldingsController],
  providers: [
    PortfolioRepository,
    { provide: PORTFOLIO_REPOSITORY, useExisting: PortfolioRepository },
    HoldingRepository,
    { provide: HOLDING_REPOSITORY, useExisting: HoldingRepository },
    CreatePortfolioUseCase,
    { provide: CREATE_PORTFOLIO_USE_CASE, useExisting: CreatePortfolioUseCase },
    GetPortfolioUseCase,
    { provide: GET_PORTFOLIO_USE_CASE, useExisting: GetPortfolioUseCase },
    ListPortfoliosUseCase,
    { provide: LIST_PORTFOLIOS_USE_CASE, useExisting: ListPortfoliosUseCase },
    CreateHoldingUseCase,
    { provide: CREATE_HOLDING_USE_CASE, useExisting: CreateHoldingUseCase },
    UpdateHoldingUseCase,
    { provide: UPDATE_HOLDING_USE_CASE, useExisting: UpdateHoldingUseCase },
    DeleteHoldingUseCase,
    { provide: DELETE_HOLDING_USE_CASE, useExisting: DeleteHoldingUseCase },
    ListHoldingsUseCase,
    { provide: LIST_HOLDINGS_USE_CASE, useExisting: ListHoldingsUseCase },
    PortfolioMapper,
    HoldingMapper
  ]
})
export class PortfolioModule {}
