import { IAssetRepository } from '@features/assets/application/interfaces/assets.interface';
import { ASSET_REPOSITORY } from '@features/assets/application/interfaces/assets.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioOpeningBalance } from '../../domain/entities/portfolio-opening-balance.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { SetPortfolioOpeningBalanceRequestDto } from '../../presentation/dto/request/set-portfolio-opening-balance.request.dto';
import {
  IPortfolioCalculationCheckpointRepository,
  IPortfolioOpeningBalanceRepository,
  IPortfolioRepository,
  ISetPortfolioOpeningBalanceUseCase,
  PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY,
  PORTFOLIO_OPENING_BALANCE_REPOSITORY,
  PORTFOLIO_REPOSITORY,
  SetPortfolioOpeningBalanceData
} from '../interfaces/portfolio.interface';

@Injectable()
export class SetPortfolioOpeningBalanceUseCase implements ISetPortfolioOpeningBalanceUseCase {
  constructor(
    @Inject(PORTFOLIO_OPENING_BALANCE_REPOSITORY)
    private readonly openingBalanceRepository: IPortfolioOpeningBalanceRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    @Inject(PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY)
    private readonly checkpointRepository: IPortfolioCalculationCheckpointRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SetPortfolioOpeningBalanceUseCase.name);
  }

  async execute(
    userId: string,
    portfolioId: string,
    assetId: string,
    dto: SetPortfolioOpeningBalanceRequestDto
  ): Promise<PortfolioOpeningBalance> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const asset = await this.assetRepository.findById(assetId);

    if (!asset) {
      throw PortfolioErrors.assetNotFound(assetId);
    }

    const data: SetPortfolioOpeningBalanceData = {
      userId,
      portfolioId,
      assetId,
      openingQuantity: dto.openingQuantity,
      openingCost: dto.openingCost
    };
    // Upsert and invalidate the asset's calculation checkpoints atomically
    // under the (portfolioId, assetId) advisory lock.
    const openingBalance = await this.checkpointRepository.withAssetLock(
      portfolioId,
      assetId,
      async (manager) => {
        const upserted = await this.openingBalanceRepository.upsert(
          data,
          manager
        );
        await this.checkpointRepository.deleteByPortfolioAndAsset(
          portfolioId,
          assetId,
          manager
        );
        return upserted;
      }
    );

    openingBalance.portfolio = portfolio;
    openingBalance.asset = asset;

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_OPENING_BALANCE_SET,
        openingBalanceId: openingBalance.id,
        userId,
        portfolioId,
        assetId,
        openingQuantity: openingBalance.openingQuantity,
        openingCost: openingBalance.openingCost
      },
      'Portfolio opening balance set'
    );

    return openingBalance;
  }
}
