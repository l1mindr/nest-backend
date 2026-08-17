import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { UpdatePortfolioRequestDto } from '../../presentation/dto/request/update-portfolio.request.dto';
import {
  IPortfolioRepository,
  IUpdatePortfolioUseCase,
  PORTFOLIO_REPOSITORY,
  UpdatePortfolioData
} from '../interfaces/portfolio.interface';

import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';

@Injectable()
export class UpdatePortfolioUseCase implements IUpdatePortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService
  ) {
    this.logger.setContext(UpdatePortfolioUseCase.name);
  }

  async execute(
    portfolioId: string,
    userId: string,
    dto: UpdatePortfolioRequestDto
  ): Promise<Portfolio> {
    if (
      dto.name === undefined &&
      dto.sourceType === undefined &&
      dto.walletAddress === undefined
    ) {
      throw PortfolioErrors.portfolioEmptyUpdate();
    }

    const existing = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!existing) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const data: UpdatePortfolioData = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sourceType !== undefined) data.sourceType = dto.sourceType;
    if (dto.walletAddress !== undefined) data.walletAddress = dto.walletAddress;

    const updated = await this.portfolioRepository.update(
      portfolioId,
      userId,
      data
    );

    if (!updated) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_UPDATED,
        portfolioId,
        userId,
        sourceType: updated.sourceType
      },
      'Portfolio source updated'
    );

    this.auditLogService.record({
      action: AuditAction.PORTFOLIO_UPDATED,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.PORTFOLIO,
      resourceId: portfolioId,
      success: true
    });

    return updated;
  }
}
