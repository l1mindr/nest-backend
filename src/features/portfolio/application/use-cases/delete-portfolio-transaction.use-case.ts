import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  IDeletePortfolioTransactionUseCase,
  IPortfolioCalculationCheckpointRepository,
  IPortfolioRepository,
  IPortfolioTransactionRepository,
  PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY,
  PORTFOLIO_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY
} from '../interfaces/portfolio.interface';

import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';

@Injectable()
export class DeletePortfolioTransactionUseCase implements IDeletePortfolioTransactionUseCase {
  constructor(
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY)
    private readonly checkpointRepository: IPortfolioCalculationCheckpointRepository,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService
  ) {
    this.logger.setContext(DeletePortfolioTransactionUseCase.name);
  }

  async execute(
    userId: string,
    portfolioId: string,
    transactionId: string
  ): Promise<void> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    // Resolve the transaction so its asset scopes the invalidation below.
    const existing =
      await this.transactionRepository.findByIdAndPortfolioAndUser(
        transactionId,
        portfolioId,
        userId
      );

    if (!existing) {
      throw PortfolioErrors.transactionNotFound(transactionId);
    }

    // Delete and invalidate the asset's calculation checkpoints atomically
    // under the (portfolioId, assetId) advisory lock.
    const deleted = await this.checkpointRepository.withAssetLock(
      portfolioId,
      existing.assetId,
      async (manager) => {
        const removed =
          await this.transactionRepository.deleteByIdAndPortfolioAndUser(
            transactionId,
            portfolioId,
            userId,
            manager
          );
        await this.checkpointRepository.deleteByPortfolioAndAsset(
          portfolioId,
          existing.assetId,
          manager
        );
        return removed;
      }
    );

    if (!deleted) {
      throw PortfolioErrors.transactionNotFound(transactionId);
    }

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_TRANSACTION_DELETED,
        transactionId,
        userId,
        portfolioId
      },
      'Portfolio transaction deleted'
    );

    this.auditLogService.record({
      action: AuditAction.TRANSACTION_DELETED,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.TRANSACTION,
      resourceId: transactionId,
      success: true
    });
  }
}
