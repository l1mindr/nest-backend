import { Asset } from '@features/assets/domain/entities/asset.entity';
import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioTransaction } from '../../../domain/entities/portfolio-transaction.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { TransactionPriceCurrency } from '../../../domain/enums/transaction-price-currency.enum';
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
  const wallet = {
    id: 'wallet-id',
    userId: 'user-id',
    name: 'MetaMask',
    address: null
  };
  const walletRepository = {
    findByIdAndUser: jest.fn()
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
  const realtimeEventPublisher = {
    publishToUser: jest.fn(),
    disconnectSession: jest.fn(),
    disconnectUser: jest.fn(),
    disconnectUserExcept: jest.fn()
  };

  /**
   * Stands in for the real normalizer, which is covered by its own spec. The
   * default passes a USD entry straight through, which is what every test here
   * that predates Toman support expects; the Toman tests override it.
   */
  const priceNormalizer = {
    normalize: jest.fn(
      async (input: { price: string | null; fee: string | null }) => ({
        price: input.price,
        fee: input.fee,
        priceCurrency: TransactionPriceCurrency.USD,
        enteredPrice: null,
        enteredFee: null,
        usdtTomanRate: null
      })
    )
  };

  let useCase: CreatePortfolioTransactionUseCase;

  const activityRecorder = { record: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    assetRepository.findById.mockResolvedValue(asset);
    transactionRepository.create.mockResolvedValue(transaction);
    transactionRepository.listByPortfolioAndAsset.mockResolvedValue([]);
    holdingsService.getAssetQuantity.mockResolvedValue('10');
    holdingsService.canSell.mockReturnValue(true);
    walletRepository.findByIdAndUser.mockResolvedValue(wallet);

    useCase = new CreatePortfolioTransactionUseCase(
      transactionRepository as any,
      portfolioRepository as any,
      assetRepository as any,
      checkpointRepository as any,
      walletRepository as any,
      holdingsService as any,
      priceNormalizer as any,
      logger as any,
      auditLogService as any,
      realtimeEventPublisher as any,
      activityRecorder as any
    );
  });

  describe('price denomination', () => {
    it('should default a BUY to USD and record no conversion', async () => {
      await useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.BUY,
        amount: '1.5',
        price: '60000.5',
        fee: '0.75',
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any);

      expect(priceNormalizer.normalize).toHaveBeenCalledWith({
        type: PortfolioTransactionType.BUY,
        price: '60000.5',
        fee: '0.75',
        priceCurrency: undefined
      });
      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          price: '60000.5',
          fee: '0.75',
          priceCurrency: TransactionPriceCurrency.USD,
          enteredPrice: null,
          enteredFee: null,
          usdtTomanRate: null
        }),
        expect.any(Object)
      );
    });

    it('should persist the converted USD figures and the Toman originals', async () => {
      priceNormalizer.normalize.mockResolvedValueOnce({
        price: '0.99736168',
        fee: '0.21311147',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        enteredPrice: '234000',
        enteredFee: '50000',
        usdtTomanRate: '234619'
      } as never);

      await useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.BUY,
        amount: '100',
        price: '234000',
        fee: '50000',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        occurredAt: '2026-07-28T08:00:00.000Z'
      } as any);

      expect(priceNormalizer.normalize).toHaveBeenCalledWith({
        type: PortfolioTransactionType.BUY,
        price: '234000',
        fee: '50000',
        priceCurrency: TransactionPriceCurrency.TOMAN
      });
      // `price`/`fee` reach the ledger in USD — the cost-basis engine reads
      // them — while the Toman the user typed is preserved beside them.
      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '100',
          price: '0.99736168',
          fee: '0.21311147',
          priceCurrency: TransactionPriceCurrency.TOMAN,
          enteredPrice: '234000',
          enteredFee: '50000',
          usdtTomanRate: '234619'
        }),
        expect.any(Object)
      );
    });

    it('should surface a rejection from the normalizer rather than storing anything', async () => {
      priceNormalizer.normalize.mockRejectedValueOnce(new Error('no rate'));

      await expect(
        useCase.execute('user-id', 'portfolio-id', {
          assetId: 'asset-id',
          type: PortfolioTransactionType.BUY,
          amount: '100',
          price: '234000',
          priceCurrency: TransactionPriceCurrency.TOMAN,
          occurredAt: '2026-07-28T08:00:00.000Z'
        } as any)
      ).rejects.toThrow('no rate');

      expect(transactionRepository.create).not.toHaveBeenCalled();
    });
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
      occurredAt: '2026-07-28T08:00:00.000Z',
      destinationType: 'EXCHANGE',
      exchangeName: 'Binance'
    } as any);

    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PortfolioTransactionType.TRANSFER_IN,
        price: null,
        fee: null,
        notes: null,
        destinationType: 'EXCHANGE',
        exchangeName: 'Binance',
        txid: null,
        walletId: null
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
        occurredAt: '2026-07-28T08:00:00.000Z',
        destinationType: 'EXCHANGE',
        exchangeName: 'Binance'
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
      occurredAt: '2026-07-28T08:00:00.000Z',
      destinationType: 'WALLET',
      walletId: 'wallet-id'
    } as any);

    expect(transactionRepository.create).toHaveBeenCalled();
    expect(result.asset).toBe(asset);
  });

  describe('transfer destination validation', () => {
    it('rejects a transfer with no destinationType', async () => {
      await expect(
        useCase.execute('user-id', 'portfolio-id', {
          assetId: 'asset-id',
          type: PortfolioTransactionType.TRANSFER_IN,
          amount: '1',
          occurredAt: '2026-07-28T08:00:00.000Z'
        } as any)
      ).rejects.toMatchObject({
        code: PortfolioErrorCode.TRANSFER_DESTINATION_REQUIRED
      });

      expect(transactionRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an EXCHANGE transfer with no exchangeName', async () => {
      await expect(
        useCase.execute('user-id', 'portfolio-id', {
          assetId: 'asset-id',
          type: PortfolioTransactionType.TRANSFER_IN,
          amount: '1',
          occurredAt: '2026-07-28T08:00:00.000Z',
          destinationType: 'EXCHANGE'
        } as any)
      ).rejects.toMatchObject({
        code: PortfolioErrorCode.TRANSFER_EXCHANGE_NAME_REQUIRED
      });

      expect(transactionRepository.create).not.toHaveBeenCalled();
    });

    it('accepts an EXCHANGE transfer without a txid (optional)', async () => {
      await useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.TRANSFER_IN,
        amount: '1',
        occurredAt: '2026-07-28T08:00:00.000Z',
        destinationType: 'EXCHANGE',
        exchangeName: 'Kraken'
      } as any);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationType: 'EXCHANGE',
          exchangeName: 'Kraken',
          txid: null,
          walletId: null
        }),
        expect.any(Object)
      );
    });

    it('carries the txid through when supplied', async () => {
      await useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.TRANSFER_IN,
        amount: '1',
        occurredAt: '2026-07-28T08:00:00.000Z',
        destinationType: 'EXCHANGE',
        exchangeName: 'Kraken',
        txid: '0xabc123'
      } as any);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ txid: '0xabc123' }),
        expect.any(Object)
      );
    });

    it('rejects a WALLET transfer with no walletId', async () => {
      await expect(
        useCase.execute('user-id', 'portfolio-id', {
          assetId: 'asset-id',
          type: PortfolioTransactionType.TRANSFER_IN,
          amount: '1',
          occurredAt: '2026-07-28T08:00:00.000Z',
          destinationType: 'WALLET'
        } as any)
      ).rejects.toMatchObject({
        code: PortfolioErrorCode.TRANSFER_WALLET_NOT_FOUND
      });

      expect(transactionRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a walletId that does not belong to the caller', async () => {
      walletRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        useCase.execute('user-id', 'portfolio-id', {
          assetId: 'asset-id',
          type: PortfolioTransactionType.TRANSFER_IN,
          amount: '1',
          occurredAt: '2026-07-28T08:00:00.000Z',
          destinationType: 'WALLET',
          walletId: 'someone-elses-wallet'
        } as any)
      ).rejects.toMatchObject({
        code: PortfolioErrorCode.TRANSFER_WALLET_NOT_FOUND
      });

      expect(walletRepository.findByIdAndUser).toHaveBeenCalledWith(
        'someone-elses-wallet',
        'user-id'
      );
      expect(transactionRepository.create).not.toHaveBeenCalled();
    });

    it('accepts a WALLET transfer with an owned wallet', async () => {
      await useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.TRANSFER_IN,
        amount: '1',
        occurredAt: '2026-07-28T08:00:00.000Z',
        destinationType: 'WALLET',
        walletId: 'wallet-id'
      } as any);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationType: 'WALLET',
          walletId: 'wallet-id',
          exchangeName: null,
          txid: null
        }),
        expect.any(Object)
      );
    });

    it('ignores destination fields on a BUY transaction', async () => {
      await useCase.execute('user-id', 'portfolio-id', {
        assetId: 'asset-id',
        type: PortfolioTransactionType.BUY,
        amount: '1',
        price: '10',
        occurredAt: '2026-07-28T08:00:00.000Z',
        destinationType: 'EXCHANGE',
        exchangeName: 'Should be ignored'
      } as any);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationType: null,
          exchangeName: null,
          txid: null,
          walletId: null
        }),
        expect.any(Object)
      );
      expect(walletRepository.findByIdAndUser).not.toHaveBeenCalled();
    });
  });
});
