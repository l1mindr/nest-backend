import { IAssetRepository } from '@features/assets/application/interfaces/assets.interface';
import { ASSET_REPOSITORY } from '@features/assets/application/interfaces/assets.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { PortfolioTransactionType } from '../../domain/enums/portfolio-transaction-type.enum';
import { CreatePortfolioTransactionRequestDto } from '../../presentation/dto/request/create-portfolio-transaction.request.dto';
import {
  CreatePortfolioTransactionData,
  ICreatePortfolioTransactionUseCase,
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
import {
  IRealtimeEventPublisher,
  REALTIME_EVENT_PUBLISHER
} from '@features/realtime/application/interfaces/realtime.interface';
import { HoldingsService } from '../../infrastructure/providers/holdings.service';

@Injectable()
export class CreatePortfolioTransactionUseCase implements ICreatePortfolioTransactionUseCase {
  constructor(
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    @Inject(PORTFOLIO_CALCULATION_CHECKPOINT_REPOSITORY)
    private readonly checkpointRepository: IPortfolioCalculationCheckpointRepository,
    private readonly holdingsService: HoldingsService,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService,
    @Inject(REALTIME_EVENT_PUBLISHER)
    private readonly realtimeEventPublisher: IRealtimeEventPublisher
  ) {
    this.logger.setContext(CreatePortfolioTransactionUseCase.name);
  }

  async execute(
    userId: string,
    portfolioId: string,
    dto: CreatePortfolioTransactionRequestDto
  ): Promise<PortfolioTransaction> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const asset = await this.assetRepository.findById(dto.assetId);

    if (!asset) {
      throw PortfolioErrors.assetNotFound(dto.assetId);
    }

    if (
      dto.type === PortfolioTransactionType.DEPOSIT ||
      dto.type === PortfolioTransactionType.WITHDRAWAL
    ) {
      throw PortfolioErrors.transactionTypeNotSupported();
    }

    if (
      (dto.type === PortfolioTransactionType.BUY ||
        dto.type === PortfolioTransactionType.SELL) &&
      dto.price === undefined
    ) {
      throw PortfolioErrors.transactionPriceRequired();
    }

    // A position can only leave the portfolio if the ledger says it is there.
    // The quantity is resolved through the same service the holdings endpoint
    // uses, so a rejection here always matches what the user sees.
    if (
      dto.type === PortfolioTransactionType.SELL ||
      dto.type === PortfolioTransactionType.TRANSFER_OUT
    ) {
      const currentHoldings = await this.holdingsService.getAssetQuantity(
        portfolioId,
        dto.assetId,
        userId
      );

      if (
        !this.holdingsService.canSell(currentHoldings, dto.amount.toString())
      ) {
        throw PortfolioErrors.insufficientHoldings(
          dto.assetId,
          currentHoldings,
          dto.amount.toString()
        );
      }
    }

    const data: CreatePortfolioTransactionData = {
      userId,
      portfolioId,
      assetId: dto.assetId,
      type: dto.type,
      amount: dto.amount,
      price: dto.price ?? null,
      fee: dto.fee ?? null,
      occurredAt: new Date(dto.occurredAt),
      notes: dto.notes ?? null
    };

    // Persist and invalidate the asset's calculation checkpoints atomically
    // under the (portfolioId, assetId) advisory lock, so a concurrent P&L can
    // never save a checkpoint from a ledger that omits this transaction.
    const transaction = await this.checkpointRepository.withAssetLock(
      portfolioId,
      dto.assetId,
      async (manager) => {
        const created = await this.transactionRepository.create(data, manager);
        await this.checkpointRepository.deleteByPortfolioAndAsset(
          portfolioId,
          dto.assetId,
          manager
        );
        return created;
      }
    );

    transaction.portfolio = portfolio;
    transaction.asset = asset;

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_TRANSACTION_CREATED,
        transactionId: transaction.id,
        userId,
        portfolioId,
        assetId: transaction.assetId,
        type: transaction.type,
        amount: transaction.amount,
        price: transaction.price,
        fee: transaction.fee
      },
      'Portfolio transaction created'
    );

    this.auditLogService.record({
      action: AuditAction.TRANSACTION_CREATED,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.TRANSACTION,
      resourceId: transaction.id,
      success: true
    });

    this.realtimeEventPublisher.publishToUser(userId, {
      type: 'transaction.created',
      payload: { portfolioId, transactionId: transaction.id }
    });

    return transaction;
  }
}
