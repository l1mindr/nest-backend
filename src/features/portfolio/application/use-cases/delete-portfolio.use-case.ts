import { LogEvent } from '@infrastructure/logging/logging.constants';
import {
  IUserActivityRecorder,
  USER_ACTIVITY_RECORDER
} from '@features/activity/application/interfaces/activity.interface';
import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  IDeletePortfolioUseCase,
  IPortfolioCalculationCheckpointRepository,
  IPortfolioRepository,
  PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';

@Injectable()
export class DeletePortfolioUseCase implements IDeletePortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY)
    private readonly checkpointRepository: IPortfolioCalculationCheckpointRepository,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService,
    @Inject(USER_ACTIVITY_RECORDER)
    private readonly activityRecorder: IUserActivityRecorder
  ) {
    this.logger.setContext(DeletePortfolioUseCase.name);
  }

  async execute(portfolioId: string, userId: string): Promise<void> {
    const deleted = await this.portfolioRepository.delete(portfolioId, userId);

    if (!deleted) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    // Remove the portfolio's calculation checkpoints. Orphans would be inert —
    // the P&L guarded save skips portfolios with no ledger — but they are
    // cleaned up here so they never accumulate.
    await this.checkpointRepository.deleteByPortfolio(portfolioId);

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_DELETED,
        portfolioId,
        userId
      },
      'Portfolio source deleted'
    );

    this.auditLogService.record({
      action: AuditAction.PORTFOLIO_DELETED,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.PORTFOLIO,
      resourceId: portfolioId,
      success: true
    });

    // No name in the metadata: the row is gone by now, and `delete` reports
    // only whether it removed anything.
    this.activityRecorder.record({
      userId,
      category: ActivityCategory.PORTFOLIO,
      action: ActivityAction.DELETED,
      entityType: 'PORTFOLIO',
      entityId: portfolioId
    });
  }
}
