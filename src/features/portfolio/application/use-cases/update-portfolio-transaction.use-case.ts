import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { PortfolioTransactionType } from '../../domain/enums/portfolio-transaction-type.enum';
import { UpdatePortfolioTransactionRequestDto } from '../../presentation/dto/request/update-portfolio-transaction.request.dto';
import {
  IPortfolioRepository,
  IPortfolioTransactionRepository,
  IUpdatePortfolioTransactionUseCase,
  PORTFOLIO_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY,
  UpdatePortfolioTransactionData
} from '../interfaces/portfolio.interface';

@Injectable()
export class UpdatePortfolioTransactionUseCase implements IUpdatePortfolioTransactionUseCase {
  constructor(
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UpdatePortfolioTransactionUseCase.name);
  }

  async execute(
    userId: string,
    portfolioId: string,
    transactionId: string,
    dto: UpdatePortfolioTransactionRequestDto
  ): Promise<PortfolioTransaction> {
    if (
      dto.type === undefined &&
      dto.amount === undefined &&
      dto.price === undefined &&
      dto.fee === undefined &&
      dto.occurredAt === undefined &&
      dto.notes === undefined
    ) {
      throw PortfolioErrors.transactionEmptyUpdate();
    }

    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const existing =
      await this.transactionRepository.findByIdAndPortfolioAndUser(
        transactionId,
        portfolioId,
        userId
      );

    if (!existing) {
      throw PortfolioErrors.transactionNotFound(transactionId);
    }

    const updatedType = dto.type ?? existing.type;

    if (
      updatedType === PortfolioTransactionType.DEPOSIT ||
      updatedType === PortfolioTransactionType.WITHDRAWAL
    ) {
      throw PortfolioErrors.transactionTypeNotSupported();
    }

    const updatedPrice = dto.price !== undefined ? dto.price : existing.price;

    if (
      (updatedType === PortfolioTransactionType.BUY ||
        updatedType === PortfolioTransactionType.SELL) &&
      updatedPrice === null
    ) {
      throw PortfolioErrors.transactionPriceRequired();
    }

    const data: UpdatePortfolioTransactionData = {};

    if (dto.type !== undefined) data.type = dto.type;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.fee !== undefined) data.fee = dto.fee;
    if (dto.occurredAt !== undefined)
      data.occurredAt = new Date(dto.occurredAt);
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.transactionRepository.update(
      transactionId,
      portfolioId,
      userId,
      data
    );

    if (!updated) {
      throw PortfolioErrors.transactionNotFound(transactionId);
    }

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_TRANSACTION_UPDATED,
        transactionId,
        userId,
        portfolioId,
        type: updated.type,
        amount: updated.amount,
        price: updated.price
      },
      'Portfolio transaction updated'
    );

    return updated;
  }
}
