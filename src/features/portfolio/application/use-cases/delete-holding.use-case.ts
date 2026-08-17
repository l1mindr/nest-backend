import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  HOLDING_REPOSITORY,
  IDeleteHoldingUseCase,
  IHoldingRepository
} from '../interfaces/portfolio.interface';

import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';

@Injectable()
export class DeleteHoldingUseCase implements IDeleteHoldingUseCase {
  constructor(
    @Inject(HOLDING_REPOSITORY)
    private readonly holdingRepository: IHoldingRepository,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService
  ) {
    this.logger.setContext(DeleteHoldingUseCase.name);
  }

  async execute(holdingId: string, userId: string): Promise<void> {
    const deleted = await this.holdingRepository.delete(holdingId, userId);

    if (!deleted) {
      throw PortfolioErrors.holdingNotFound(holdingId);
    }

    this.logger.info(
      {
        event: LogEvent.HOLDING_DELETED,
        holdingId,
        userId
      },
      'Portfolio holding deleted'
    );

    this.auditLogService.record({
      action: AuditAction.HOLDING_DELETED,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.HOLDING,
      resourceId: holdingId,
      success: true
    });
  }
}
