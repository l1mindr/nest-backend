import {
  decodeCursor,
  encodeCursor,
  isValidUUID
} from '@core/pagination/cursor.util';
import { paginate } from '@core/pagination/paginate.util';
import { Inject, Injectable } from '@nestjs/common';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import {
  PORTFOLIO_TRANSACTIONS_PAGE_SIZE_DEFAULT,
  PortfolioTransactionListRequestDto
} from '../../presentation/dto/request/portfolio-transaction-list.request.dto';
import {
  IPortfolioRepository,
  IPortfolioTransactionRepository,
  IListPortfolioTransactionsUseCase,
  PaginatedTransactions,
  PORTFOLIO_REPOSITORY,
  PortfolioTransactionCursor,
  PORTFOLIO_TRANSACTION_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class ListPortfolioTransactionsUseCase implements IListPortfolioTransactionsUseCase {
  constructor(
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository
  ) {}

  async execute(
    userId: string,
    portfolioId: string,
    query: PortfolioTransactionListRequestDto
  ): Promise<PaginatedTransactions> {
    const portfolio = await this.portfolioRepository.findByIdAndUser(
      portfolioId,
      userId
    );

    if (!portfolio) {
      throw PortfolioErrors.portfolioNotFound(portfolioId);
    }

    const take = query.limit ?? PORTFOLIO_TRANSACTIONS_PAGE_SIZE_DEFAULT;
    const cursor = this.parseCursor(query.cursor);

    const transactions =
      await this.transactionRepository.listByPortfolioAndUser({
        userId,
        portfolioId,
        assetId: query.assetId,
        type: query.type,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        cursor,
        limit: take + 1
      });

    return paginate(transactions, take, (transaction) =>
      encodeCursor(
        JSON.stringify({
          occurredAt: transaction.occurredAt.toISOString(),
          id: transaction.id
        })
      )
    );
  }

  private parseCursor(cursor?: string): PortfolioTransactionCursor | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = decodeCursor(cursor);
    } catch {
      throw PortfolioErrors.invalidCursor();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      throw PortfolioErrors.invalidCursor();
    }

    if (!this.isCursor(parsed)) {
      throw PortfolioErrors.invalidCursor();
    }

    return { occurredAt: new Date(parsed.occurredAt), id: parsed.id };
  }

  private isCursor(
    value: unknown
  ): value is { occurredAt: string; id: string } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as { occurredAt?: unknown; id?: unknown };

    if (
      typeof candidate.occurredAt !== 'string' ||
      typeof candidate.id !== 'string'
    ) {
      return false;
    }

    if (!isValidUUID(candidate.id)) {
      return false;
    }

    return !Number.isNaN(Date.parse(candidate.occurredAt));
  }
}
