import { IAssetRepository } from '@features/assets/application/interfaces/assets.interface';
import { ASSET_REPOSITORY } from '@features/assets/application/interfaces/assets.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Holding } from '../../domain/entities/holding.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { throwOnHoldingUniqueConstraint } from '../../infrastructure/providers/unique-constraint.handler';
import { CreateHoldingRequestDto } from '../../presentation/dto/request/create-holding.request.dto';
import {
  CreateHoldingData,
  ICreateHoldingUseCase,
  IHoldingRepository,
  IPortfolioRepository,
  HOLDING_REPOSITORY,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';

@Injectable()
export class CreateHoldingUseCase implements ICreateHoldingUseCase {
  constructor(
    @Inject(HOLDING_REPOSITORY)
    private readonly holdingRepository: IHoldingRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService
  ) {
    this.logger.setContext(CreateHoldingUseCase.name);
  }

  async execute(
    userId: string,
    dto: CreateHoldingRequestDto
  ): Promise<Holding> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      dto.portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(dto.portfolioId);
    }

    const asset = await this.assetRepository.findById(dto.assetId);

    if (!asset) {
      throw PortfolioErrors.assetNotFound(dto.assetId);
    }

    const existing = await this.holdingRepository.findByPortfolioAndAsset(
      dto.portfolioId,
      dto.assetId
    );

    if (existing) {
      throw PortfolioErrors.holdingAlreadyExists();
    }

    const data: CreateHoldingData = {
      userId,
      portfolioId: dto.portfolioId,
      assetId: dto.assetId,
      amount: dto.amount,
      notes: dto.notes ?? null
    };

    let holding: Holding;

    try {
      holding = await this.holdingRepository.create(data);
    } catch (error) {
      throwOnHoldingUniqueConstraint(error);
    }

    holding.portfolio = portfolio;
    holding.asset = asset;

    this.logger.info(
      {
        event: LogEvent.HOLDING_CREATED,
        holdingId: holding.id,
        userId,
        portfolioId: holding.portfolioId,
        assetId: holding.assetId,
        amount: holding.amount
      },
      'Portfolio holding created'
    );

    this.auditLogService.record({
      action: AuditAction.HOLDING_CREATED,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.HOLDING,
      resourceId: holding.id,
      success: true
    });

    return holding;
  }
}
