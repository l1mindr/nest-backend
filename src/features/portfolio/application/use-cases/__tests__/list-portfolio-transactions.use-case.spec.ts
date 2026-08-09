import { decodeCursor, encodeCursor } from '@core/pagination/cursor.util';
import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioTransaction } from '../../../domain/entities/portfolio-transaction.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import {
  PORTFOLIO_TRANSACTIONS_PAGE_SIZE_DEFAULT,
  PortfolioTransactionListRequestDto
} from '../../../presentation/dto/request/portfolio-transaction-list.request.dto';
import { ListPortfolioTransactionsUseCase } from '../list-portfolio-transactions.use-case';

describe('ListPortfolioTransactionsUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'Ledger'
  } as Portfolio;
  const transactionRepository = {
    listByPortfolioAndUser: jest.fn()
  };
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };

  let useCase: ListPortfolioTransactionsUseCase;

  function makeTransaction(i: number): PortfolioTransaction {
    return {
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      userId: 'user-id',
      portfolioId: 'portfolio-id',
      assetId: 'asset-id',
      type: PortfolioTransactionType.BUY,
      amount: '1',
      price: '10',
      fee: null,
      occurredAt: new Date(Date.UTC(2026, 7, 1, 12, 0, i)),
      notes: null
    } as PortfolioTransaction;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    transactionRepository.listByPortfolioAndUser.mockResolvedValue([
      makeTransaction(2),
      makeTransaction(1),
      makeTransaction(0)
    ]);

    useCase = new ListPortfolioTransactionsUseCase(
      transactionRepository as any,
      portfolioRepository as any
    );
  });

  it('should list the default page size', async () => {
    const result = await useCase.execute('user-id', 'portfolio-id', {} as any);

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(transactionRepository.listByPortfolioAndUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        portfolioId: 'portfolio-id',
        limit: PORTFOLIO_TRANSACTIONS_PAGE_SIZE_DEFAULT + 1,
        cursor: null
      })
    );
    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeNull();
  });

  it('should paginate when more items than the page size come back', async () => {
    const items = Array.from({ length: 21 }, (_, i) => makeTransaction(i));
    transactionRepository.listByPortfolioAndUser.mockResolvedValue(items);

    const result = await useCase.execute('user-id', 'portfolio-id', {
      limit: 20
    } as any);

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toEqual(expect.any(String));

    const decoded = JSON.parse(decodeCursor(result.nextCursor!)) as {
      occurredAt: string;
      id: string;
    };
    expect(decoded.id).toBe(items[19].id);
    expect(new Date(decoded.occurredAt).getTime()).toBe(
      items[19].occurredAt.getTime()
    );
  });

  it('should forward filters and decode the cursor', async () => {
    const cursor = encodeCursor(
      JSON.stringify({
        occurredAt: '2026-07-28T08:00:00.000Z',
        id: '00000000-0000-4000-8000-000000000009'
      })
    );

    await useCase.execute('user-id', 'portfolio-id', {
      limit: 5,
      assetId: 'asset-id',
      type: PortfolioTransactionType.SELL,
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T00:00:00.000Z',
      cursor
    } as PortfolioTransactionListRequestDto);

    expect(transactionRepository.listByPortfolioAndUser).toHaveBeenCalledWith({
      userId: 'user-id',
      portfolioId: 'portfolio-id',
      assetId: 'asset-id',
      type: PortfolioTransactionType.SELL,
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-07-31T00:00:00.000Z'),
      cursor: {
        occurredAt: new Date('2026-07-28T08:00:00.000Z'),
        id: '00000000-0000-4000-8000-000000000009'
      },
      limit: 6
    });
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'foreign-portfolio', {} as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(transactionRepository.listByPortfolioAndUser).not.toHaveBeenCalled();
  });

  it('should reject a cursor that is not JSON', async () => {
    const cursor = encodeCursor('not-json');

    await expect(
      useCase.execute('user-id', 'portfolio-id', { cursor } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.INVALID_CURSOR
    });

    expect(transactionRepository.listByPortfolioAndUser).not.toHaveBeenCalled();
  });

  it('should reject a cursor with an invalid identifier', async () => {
    const cursor = encodeCursor(
      JSON.stringify({ occurredAt: '2026-07-28T08:00:00.000Z', id: 'nope' })
    );

    await expect(
      useCase.execute('user-id', 'portfolio-id', { cursor } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.INVALID_CURSOR
    });
  });

  it('should reject a cursor with an invalid instant', async () => {
    const cursor = encodeCursor(
      JSON.stringify({
        occurredAt: 'not-a-date',
        id: '00000000-0000-4000-8000-000000000009'
      })
    );

    await expect(
      useCase.execute('user-id', 'portfolio-id', { cursor } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.INVALID_CURSOR
    });
  });
});
