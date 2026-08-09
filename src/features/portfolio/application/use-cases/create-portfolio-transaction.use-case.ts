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
  IPortfolioRepository,
  IPortfolioTransactionRepository,
  PORTFOLIO_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class CreatePortfolioTransactionUseCase implements ICreatePortfolioTransactionUseCase {
  constructor(
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    private readonly logger: PinoLogger
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

    const transaction = await this.transactionRepository.create(data);

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

    return transaction;
  }
}
