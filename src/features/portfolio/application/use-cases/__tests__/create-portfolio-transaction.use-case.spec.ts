import { Asset } from '@features/assets/domain/entities/asset.entity';
import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioTransaction } from '../../../domain/entities/portfolio-transaction.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { CreatePortfolioTransactionUseCase } from '../create-portfolio-transaction.use-case';

describe('CreatePortfolioTransactionUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'Ledger'
  } as Portfolio;
  const asset = { id: 'asset-id', symbol: 'btc', name: 'Bitcoin' } as Asset;
  const transaction = {
    id: 'transaction-id',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId: 'asset-id',
    type: PortfolioTransactionType.BUY,
    amount: '1.5',
    price: '60000.5',
    fee: null,
    notes: null
  } as PortfolioTransaction;
  const transactionRepository = {
    create: jest.fn(),
    listByPortfolioAndAsset: jest.fn()
  };
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };
  const assetRepository = {
    findById: jest.fn()
  };
  const checkpointRepository = {
    withAssetLock: jest.fn(
      async (
        _portfolioId: string,
        _assetId: string,
        work: (manager: unknown) => Promise<unknown>
      ) => work({})
    ),
    deleteByPortfolioAndAsset: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };
  const holdingsService = {
    getAssetQuantity: jest.fn(),
    canSell: jest.fn()
  };
  const auditLogService = {
    record: jest.fn()
  };

  let useCase: CreatePortfolioTransactionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    assetRepository.findById.mockResolvedValue(asset);
    transactionRepository.create.mockResolvedValue(transaction);
    transactionRepository.listByPortfolioAndAsset.mockResolvedValue([]);
    holdingsService.getAssetQuantity.mockResolvedValue('10');
    holdingsService.canSell.mockReturnValue(true);

    useCase = new CreatePortfolioTransactionUseCase(
      transactionRepository as any,
      portfolioRepository as any,
      assetRepository as any,
      checkpointRepository as any,
      holdingsService as any,
      logger as any,
      auditLogService as any
    );
  });

  it('should record a BUY transaction with the supplied price and instant', async () => {
    const result = await useCase.execute('user-id', 'portfolio-id', {
      assetId: 'asset-id',
      type: PortfolioTransactionType.BUY,
      amount: '1.5',
      price: '60000.5',
      fee: '0.75',
      occurredAt: '2026-07-28T08:00:00.000Z',
      notes: 'Cold storage'
    } as any);

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(assetRepository.findById).toHaveBeenCalledWith('asset-id');
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        portfolioId: 'portfolio-id',
        assetId: 'asset-id',
        type: PortfolioTransactionType.BUY,
        amount: '1.5',
        price: '60000.5',
        fee: '0.75',
        occurredAt: new Date('2026-07-28T08:00:00.000Z'),
        notes: 'Cold storage'
      }),
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
    expect(result.asset).toBe(asset);
    expect(result.portfolio).toBe(portfolio);
  });

  it('should record a TRANSFER_IN without a price', async () => {
    await useCase.execute('user-id', 'portfolio-id', {
      assetId: 'asset-id',
      type: PortfolioTransactionType.TRANSFER_IN,
      amount: '0.5',
      occurredAt: '2026-07-28T08:00:00.000Z'
    } as any);

    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PortfolioTransactionType.TRANSFER_IN,
        price: null,
        fee: null,
        notes: null
      }),
      expect.any(Object)
    );
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'foreign-portfolio', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.BUY,
        amount: '1',
        price: '10',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(assetRepository.findById).not.toHaveBeenCalled();
    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it('should reject an unknown asset', async () => {
    assetRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'portfolio-id', {
        assetId: 'unknown-asset',
        type: PortfolioTransactionType.BUY,
        amount: '1',
        price: '10',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_ASSET_NOT_FOUND
    });

    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it('should reject DEPOSIT transactions', async () => {
    await expect(
      useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.DEPOSIT,
        amount: '1000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_TYPE_NOT_SUPPORTED
    });

    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it('should reject WITHDRAWAL transactions', async () => {
    await expect(
      useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.WITHDRAWAL,
        amount: '1000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_TYPE_NOT_SUPPORTED
    });

    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it('should require a price for BUY', async () => {
    await expect(
      useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.BUY,
        amount: '1',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_PRICE_REQUIRED
    });

    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it('should require a price for SELL', async () => {
    await expect(
      useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.SELL,
        amount: '1',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_PRICE_REQUIRED
    });

    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it('should prevent SELL when insufficient holdings', async () => {
    holdingsService.canSell.mockReturnValue(false);

    await expect(
      useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.SELL,
        amount: '25',
        price: '60000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.INSUFFICIENT_HOLDINGS
    });

    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it('should measure available quantity through the shared holdings service', async () => {
    // Resolving through the service is what keeps oversell validation anchored
    // on the same opening balance the holdings endpoint reports.
    await useCase.execute('user-id', 'portfolio-id', {
      assetId: 'asset-id',
      type: PortfolioTransactionType.SELL,
      amount: '5',
      price: '60000',
      occurredAt: '2026-07-28T08:00:00.000Z'
    } as any);

    expect(holdingsService.getAssetQuantity).toHaveBeenCalledWith(
      'portfolio-id',
      'asset-id',
      'user-id'
    );
    expect(holdingsService.canSell).toHaveBeenCalledWith('10', '5');
  });

  it('should prevent TRANSFER_OUT when insufficient holdings', async () => {
    holdingsService.canSell.mockReturnValue(false);

    await expect(
      useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.TRANSFER_OUT,
        amount: '15',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.INSUFFICIENT_HOLDINGS
    });

    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it('should allow SELL when holdings are sufficient', async () => {
    holdingsService.canSell.mockReturnValue(true);

    const result = await useCase.execute('user-id', 'portfolio-id', {
      assetId: 'asset-id',
      type: PortfolioTransactionType.SELL,
      amount: '5',
      price: '60000',
      occurredAt: '2026-07-28T08:00:00.000Z'
    } as any);

    expect(transactionRepository.create).toHaveBeenCalled();
    expect(result.asset).toBe(asset);
  });

  it('should allow TRANSFER_OUT when holdings are sufficient', async () => {
    holdingsService.canSell.mockReturnValue(true);

    const result = await useCase.execute('user-id', 'portfolio-id', {
      assetId: 'asset-id',
      type: PortfolioTransactionType.TRANSFER_OUT,
      amount: '5',
      occurredAt: '2026-07-28T08:00:00.000Z'
    } as any);

    expect(transactionRepository.create).toHaveBeenCalled();
    expect(result.asset).toBe(asset);
  });
});
