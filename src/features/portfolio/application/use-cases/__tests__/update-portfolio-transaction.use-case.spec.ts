import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioTransaction } from '../../../domain/entities/portfolio-transaction.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { UpdatePortfolioTransactionUseCase } from '../update-portfolio-transaction.use-case';

describe('UpdatePortfolioTransactionUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'Ledger'
  } as Portfolio;
  const transaction = {
    id: 'transaction-id',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId: 'asset-id',
    type: PortfolioTransactionType.BUY,
    amount: '1.5',
    price: '60000',
    fee: '0.75',
    occurredAt: new Date('2026-07-28T08:00:00.000Z'),
    notes: 'Original note'
  } as PortfolioTransaction;
  const transactionRepository = {
    findByIdAndPortfolioAndUser: jest.fn(),
    update: jest.fn()
  };
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };
  const checkpointRepository = {
    deleteByPortfolioAndAsset: jest.fn(),
    withAssetLock: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: UpdatePortfolioTransactionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue(
      transaction
    );
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      amount: '2.0'
    });
    checkpointRepository.withAssetLock.mockImplementation(
      async (
        _portfolioId: string,
        _assetId: string,
        work: (manager: unknown) => Promise<unknown>
      ) => work({})
    );

    useCase = new UpdatePortfolioTransactionUseCase(
      transactionRepository as any,
      portfolioRepository as any,
      checkpointRepository as any,
      logger as any,
      { record: jest.fn() } as any
    );
  });

  it('should update the amount and price of a transaction', async () => {
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      amount: '2.0',
      price: '65000'
    });

    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'transaction-id',
      { amount: '2.0', price: '65000' }
    );

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(
      transactionRepository.findByIdAndPortfolioAndUser
    ).toHaveBeenCalledWith('transaction-id', 'portfolio-id', 'user-id');
    expect(transactionRepository.update).toHaveBeenCalledWith(
      'transaction-id',
      'portfolio-id',
      'user-id',
      { amount: '2.0', price: '65000' },
      expect.any(Object)
    );
    expect(checkpointRepository.withAssetLock).toHaveBeenCalledWith(
      'portfolio-id',
      'asset-id',
      expect.any(Function as any)
    );
    expect(checkpointRepository.deleteByPortfolioAndAsset).toHaveBeenCalledWith(
      'portfolio-id',
      'asset-id',
      expect.any(Object)
    );
    expect(result.amount).toBe('2.0');
    expect(result.price).toBe('65000');
  });

  it('should update the transaction type from BUY to TRANSFER_IN and clear price', async () => {
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.TRANSFER_IN,
      price: null
    });

    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'transaction-id',
      { type: PortfolioTransactionType.TRANSFER_IN, price: null }
    );

    expect(transactionRepository.update).toHaveBeenCalledWith(
      'transaction-id',
      'portfolio-id',
      'user-id',
      { type: PortfolioTransactionType.TRANSFER_IN, price: null },
      expect.any(Object)
    );
    expect(result.type).toBe(PortfolioTransactionType.TRANSFER_IN);
    expect(result.price).toBeNull();
  });

  it('should update occurredAt and notes', async () => {
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      occurredAt: new Date('2026-08-01T10:00:00.000Z'),
      notes: 'Updated note'
    });

    await useCase.execute('user-id', 'portfolio-id', 'transaction-id', {
      occurredAt: '2026-08-01T10:00:00.000Z',
      notes: 'Updated note'
    });

    expect(transactionRepository.update).toHaveBeenCalledWith(
      'transaction-id',
      'portfolio-id',
      'user-id',
      {
        occurredAt: new Date('2026-08-01T10:00:00.000Z'),
        notes: 'Updated note'
      },
      expect.any(Object)
    );
  });

  it('should clear fee and notes with null', async () => {
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      fee: null,
      notes: null
    });

    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'transaction-id',
      { fee: null, notes: null }
    );

    expect(transactionRepository.update).toHaveBeenCalledWith(
      'transaction-id',
      'portfolio-id',
      'user-id',
      { fee: null, notes: null },
      expect.any(Object)
    );
    expect(result.fee).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('should reject an empty update', async () => {
    await expect(
      useCase.execute('user-id', 'portfolio-id', 'transaction-id', {})
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_EMPTY_UPDATE
    });

    expect(portfolioRepository.findByIdAndUser).not.toHaveBeenCalled();
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'foreign-portfolio', 'transaction-id', {
        amount: '2.0'
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it('should reject a transaction that does not exist', async () => {
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'portfolio-id', 'nonexistent-tx', {
        amount: '2.0'
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_NOT_FOUND
    });

    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it('should reject updating to DEPOSIT type', async () => {
    await expect(
      useCase.execute('user-id', 'portfolio-id', 'transaction-id', {
        type: PortfolioTransactionType.DEPOSIT
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_TYPE_NOT_SUPPORTED
    });
  });

  it('should reject updating to WITHDRAWAL type', async () => {
    await expect(
      useCase.execute('user-id', 'portfolio-id', 'transaction-id', {
        type: PortfolioTransactionType.WITHDRAWAL
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_TYPE_NOT_SUPPORTED
    });
  });

  it('should reject clearing price on a BUY transaction', async () => {
    await expect(
      useCase.execute('user-id', 'portfolio-id', 'transaction-id', {
        price: null
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_PRICE_REQUIRED
    });
  });

  it('should reject changing to SELL without a price', async () => {
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.TRANSFER_IN,
      price: null
    });

    await expect(
      useCase.execute('user-id', 'portfolio-id', 'transaction-id', {
        type: PortfolioTransactionType.SELL
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_PRICE_REQUIRED
    });
  });

  it('should reject a transaction that disappeared during update', async () => {
    transactionRepository.update.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'portfolio-id', 'transaction-id', {
        amount: '2.0'
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_NOT_FOUND
    });
  });

  it('should allow changing type from SELL to TRANSFER_OUT when no new price is supplied', async () => {
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.SELL,
      price: '60000'
    });
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.TRANSFER_OUT,
      price: '60000'
    });

    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'transaction-id',
      { type: PortfolioTransactionType.TRANSFER_OUT }
    );

    expect(transactionRepository.update).toHaveBeenCalledWith(
      'transaction-id',
      'portfolio-id',
      'user-id',
      { type: PortfolioTransactionType.TRANSFER_OUT },
      expect.any(Object)
    );
    expect(result.type).toBe(PortfolioTransactionType.TRANSFER_OUT);
  });

  it('should allow changing type from BUY to SELL when the existing price satisfies the requirement', async () => {
    // existing: BUY with price '60000'; dto only changes type → updatedPrice = existing.price = '60000' (not null) → valid
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.SELL
    });

    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'transaction-id',
      { type: PortfolioTransactionType.SELL }
    );

    expect(transactionRepository.update).toHaveBeenCalledWith(
      'transaction-id',
      'portfolio-id',
      'user-id',
      { type: PortfolioTransactionType.SELL },
      expect.any(Object)
    );
    expect(result.type).toBe(PortfolioTransactionType.SELL);
  });

  it('should allow changing type from TRANSFER_IN to TRANSFER_OUT', async () => {
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.TRANSFER_IN,
      price: null
    });
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.TRANSFER_OUT,
      price: null
    });

    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'transaction-id',
      { type: PortfolioTransactionType.TRANSFER_OUT }
    );

    expect(result.type).toBe(PortfolioTransactionType.TRANSFER_OUT);
  });

  it('should allow changing type from TRANSFER_OUT to TRANSFER_IN', async () => {
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.TRANSFER_OUT,
      price: null
    });
    transactionRepository.update.mockResolvedValue({
      ...transaction,
      type: PortfolioTransactionType.TRANSFER_IN,
      price: null
    });

    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'transaction-id',
      { type: PortfolioTransactionType.TRANSFER_IN }
    );

    expect(result.type).toBe(PortfolioTransactionType.TRANSFER_IN);
  });
});
