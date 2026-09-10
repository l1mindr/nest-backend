import { LogEvent } from '@infrastructure/logging/logging.constants';
import {
  IUserActivityRecorder,
  USER_ACTIVITY_RECORDER
} from '@features/activity/application/interfaces/activity.interface';
import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import { CreatePortfolioRequestDto } from '../../presentation/dto/request/create-portfolio.request.dto';
import {
  CreatePortfolioData,
  ICreatePortfolioUseCase,
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';

@Injectable()
export class CreatePortfolioUseCase implements ICreatePortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService,
    @Inject(USER_ACTIVITY_RECORDER)
    private readonly activityRecorder: IUserActivityRecorder
  ) {
    this.logger.setContext(CreatePortfolioUseCase.name);
  }

  async execute(
    userId: string,
    dto: CreatePortfolioRequestDto
  ): Promise<Portfolio> {
    const data: CreatePortfolioData = {
      userId,
      name: dto.name,
      sourceType: dto.sourceType,
      walletAddress: dto.walletAddress ?? null
    };

    const portfolio = await this.portfolioRepository.create(data);

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_CREATED,
        portfolioId: portfolio.id,
        userId,
        sourceType: portfolio.sourceType
      },
      'Portfolio source created'
    );

    this.auditLogService.record({
      action: AuditAction.PORTFOLIO_CREATED,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.PORTFOLIO,
      resourceId: portfolio.id,
      success: true
    });

    // The name is the one field that makes the row identifiable to the user.
    this.activityRecorder.record({
      userId,
      category: ActivityCategory.PORTFOLIO,
      action: ActivityAction.CREATED,
      entityType: 'PORTFOLIO',
      entityId: portfolio.id,
      metadata: { portfolioName: portfolio.name }
    });

    return portfolio;
  }
}
