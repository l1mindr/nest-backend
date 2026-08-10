import { PortfolioCalculationEngine } from '../../../domain/calculation/portfolio-calculation.engine';
import { CalculationTransactionType } from '../../../domain/calculation/types/calculation-transaction.types';
import { CostBasisStrategy } from '../../../domain/calculation/types/cost-basis.strategy.enum';
import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioOpeningBalance } from '../../../domain/entities/portfolio-opening-balance.entity';
import { PortfolioTransaction } from '../../../domain/entities/portfolio-transaction.entity';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { GetPortfolioPnlUseCase } from '../get-portfolio-pnl.use-case';

const ASSET_META: Record<string, { symbol: string; name: string }> = {
  'asset-1': { symbol: 'btc', name: 'Bitcoin' },
  'asset-2': { symbol: 'eth', name: 'Ethereum' },
  'asset-3': { symbol: 'sol', name: 'Solana' }
};

function makeTransaction(
  overrides: Partial<PortfolioTransaction> & {
    assetCurrentPrice?: string | null;
  } = {}
): PortfolioTransaction {
  const assetId = overrides.assetId ?? 'asset-1';
  const meta = ASSET_META[assetId] ?? { symbol: 'btc', name: 'Bitcoin' };
  const isTransfer =
    overrides.type === PortfolioTransactionType.TRANSFER_IN ||
    overrides.type === PortfolioTransactionType.TRANSFER_OUT;

  return {
    id: overrides.id ?? 'tx-1',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId,
    type: overrides.type ?? PortfolioTransactionType.BUY,
    amount: overrides.amount ?? '1',
    price:
      overrides.price !== undefined
        ? overrides.price
        : isTransfer
          ? null
          : '100',
    fee: overrides.fee ?? null,
    occurredAt: overrides.occurredAt ?? new Date('2026-01-01T00:00:00.000Z'),
    notes: null,
    asset: {
      id: assetId,
      symbol: meta.symbol,
      name: meta.name,
      currentPrice:
        overrides.assetCurrentPrice !== undefined
          ? overrides.assetCurrentPrice
          : '100'
    }
  } as PortfolioTransaction;
}

function makeOpeningBalance(
  overrides: Partial<PortfolioOpeningBalance> & {
    assetCurrentPrice?: string | null;
  } = {}
): PortfolioOpeningBalance {
  const assetId = overrides.assetId ?? 'asset-1';
  const meta = ASSET_META[assetId] ?? { symbol: 'btc', name: 'Bitcoin' };

  return {
    id: overrides.id ?? 'opening-balance-1',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId,
    openingQuantity: overrides.openingQuantity ?? '1',
    openingCost: overrides.openingCost ?? '100',
    asset: {
      id: assetId,
      symbol: meta.symbol,
      name: meta.name,
      currentPrice:
        overrides.assetCurrentPrice !== undefined
          ? overrides.assetCurrentPrice
          : '100'
    }
  } as PortfolioOpeningBalance;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach((nested) => deepFreeze(nested));
    Object.freeze(value);
  }
  return value;
}

describe('GetPortfolioPnlUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'My Ledger'
  } as Portfolio;

  let portfolioRepository: { findByIdAndUser: jest.Mock };
  let transactionRepository: { listForPnl: jest.Mock };
  let openingBalanceRepository: { listForPnl: jest.Mock };
  let engineFactory: { create: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock };
  let useCase: GetPortfolioPnlUseCase;

  beforeEach(() => {
    portfolioRepository = {
      findByIdAndUser: jest.fn().mockResolvedValue(portfolio)
    };
    transactionRepository = {
      listForPnl: jest.fn().mockResolvedValue([])
    };
    openingBalanceRepository = {
      listForPnl: jest.fn().mockResolvedValue([])
    };
    engineFactory = {
      create: jest.fn(
        (strategy: CostBasisStrategy) =>
          new PortfolioCalculationEngine(strategy)
      )
    };
    logger = {
      setContext: jest.fn(),
      info: jest.fn()
    };

    useCase = new GetPortfolioPnlUseCase(
      portfolioRepository as any,
      transactionRepository as any,
      openingBalanceRepository as any,
      engineFactory as any,
      logger as any
    );
  });

  function useRealEngine() {
    engineFactory.create.mockImplementation(
      (strategy: CostBasisStrategy) => new PortfolioCalculationEngine(strategy)
    );
  }

  function engineReturns(result: {
    quantity: string;
    totalCost: string;
    averageCost: string;
    realizedPnl: unknown[];
  }) {
    const calculate = jest.fn().mockReturnValue(result);
    engineFactory.create.mockReturnValue({ calculate });
    return calculate;
  }

  describe('authorization', () => {
    it('should reject a portfolio that does not belong to the user', async () => {
      portfolioRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        useCase.execute('user-id', 'foreign-portfolio')
      ).rejects.toMatchObject({
        code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
      });
    });

    it('should treat a foreign portfolio as indistinguishable from a nonexistent one', async () => {
      portfolioRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        useCase.execute('user-id', 'portfolio-id')
      ).rejects.toMatchObject({
        code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
      });
    });

    it('should not query transactions when ownership fails', async () => {
      portfolioRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        useCase.execute('user-id', 'portfolio-id')
      ).rejects.toBeDefined();

      expect(transactionRepository.listForPnl).not.toHaveBeenCalled();
      expect(openingBalanceRepository.listForPnl).not.toHaveBeenCalled();
    });
  });

  describe('empty portfolio', () => {
    it('should report deterministic zero totals and no positions', async () => {
      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
        'portfolio-id',
        'user-id'
      );
      expect(transactionRepository.listForPnl).toHaveBeenCalledWith(
        'portfolio-id',
        'user-id'
      );
      expect(openingBalanceRepository.listForPnl).toHaveBeenCalledWith(
        'portfolio-id',
        'user-id'
      );
      expect(result).toMatchObject({
        portfolioId: 'portfolio-id',
        currency: 'USD',
        costBasisStrategy: CostBasisStrategy.AVERAGE,
        pricedPositions: 0,
        unpricedPositions: 0,
        totalCurrentValue: '0',
        totalCostBasis: '0',
        totalRealizedPnl: '0',
        totalUnrealizedPnl: '0',
        totalPnl: '0',
        positions: []
      });
    });
  });

  describe('opening balances', () => {
    it('should create a position from an opening balance without transactions', async () => {
      useRealEngine();
      openingBalanceRepository.listForPnl.mockResolvedValue([
        makeOpeningBalance({
          openingQuantity: '0.1',
          openingCost: '0.02',
          assetCurrentPrice: '0.3'
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions).toEqual([
        expect.objectContaining({
          assetId: 'asset-1',
          quantity: '0.1',
          totalCost: '0.02',
          averageCost: '0.2',
          currentValue: '0.03',
          unrealizedPnl: '0.01'
        })
      ]);
      expect(result.totalCostBasis).toBe('0.02');
      expect(result.totalPnl).toBe('0.01');
    });

    it.each([
      {
        strategy: CostBasisStrategy.AVERAGE,
        releasedCostBasis: '150',
        remainingCost: '150',
        realizedPnl: '0'
      },
      {
        strategy: CostBasisStrategy.FIFO,
        releasedCostBasis: '100',
        remainingCost: '200',
        realizedPnl: '50'
      },
      {
        strategy: CostBasisStrategy.LIFO,
        releasedCostBasis: '200',
        remainingCost: '100',
        realizedPnl: '-50'
      }
    ])(
      'should apply the opening state with $strategy cost basis',
      async ({ strategy, releasedCostBasis, remainingCost, realizedPnl }) => {
        useRealEngine();
        openingBalanceRepository.listForPnl.mockResolvedValue([
          makeOpeningBalance({
            openingQuantity: '1',
            openingCost: '100',
            assetCurrentPrice: '150'
          })
        ]);
        transactionRepository.listForPnl.mockResolvedValue([
          makeTransaction({
            id: 'buy',
            amount: '1',
            price: '200',
            occurredAt: new Date('2026-01-01T00:00:00.000Z'),
            assetCurrentPrice: '150'
          }),
          makeTransaction({
            id: 'sell',
            type: PortfolioTransactionType.SELL,
            amount: '1',
            price: '150',
            occurredAt: new Date('2026-01-02T00:00:00.000Z'),
            assetCurrentPrice: '150'
          })
        ]);

        const result = await useCase.execute(
          'user-id',
          'portfolio-id',
          strategy
        );
        const position = result.positions[0];

        expect(position.quantity).toBe('1');
        expect(position.totalCost).toBe(remainingCost);
        expect(position.realizedPnl).toBe(realizedPnl);
        expect(position.realizedPnlEvents[0].releasedCostBasis).toBe(
          releasedCostBasis
        );
      }
    );
  });

  describe('cost-basis strategy', () => {
    it('should default to AVERAGE', async () => {
      useRealEngine();

      await useCase.execute('user-id', 'portfolio-id');

      expect(engineFactory.create).toHaveBeenCalledWith(
        CostBasisStrategy.AVERAGE
      );
    });

    it('should pass an explicit AVERAGE strategy to the engine', async () => {
      await useCase.execute(
        'user-id',
        'portfolio-id',
        CostBasisStrategy.AVERAGE
      );

      expect(engineFactory.create).toHaveBeenCalledWith(
        CostBasisStrategy.AVERAGE
      );
    });

    it('should pass FIFO to the engine and compute FIFO basis', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          amount: '1',
          price: '200',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't3',
          type: PortfolioTransactionType.SELL,
          amount: '1',
          price: '150',
          occurredAt: new Date('2026-01-03T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute(
        'user-id',
        'portfolio-id',
        CostBasisStrategy.FIFO
      );

      expect(engineFactory.create).toHaveBeenCalledWith(CostBasisStrategy.FIFO);
      expect(result.positions[0].realizedPnl).toBe('50');
      expect(result.positions[0].realizedPnlEvents[0].releasedCostBasis).toBe(
        '100'
      );
    });

    it('should pass LIFO to the engine and compute LIFO basis', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          amount: '1',
          price: '200',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't3',
          type: PortfolioTransactionType.SELL,
          amount: '1',
          price: '150',
          occurredAt: new Date('2026-01-03T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute(
        'user-id',
        'portfolio-id',
        CostBasisStrategy.LIFO
      );

      expect(engineFactory.create).toHaveBeenCalledWith(CostBasisStrategy.LIFO);
      expect(result.positions[0].realizedPnl).toBe('-50');
      expect(result.positions[0].realizedPnlEvents[0].releasedCostBasis).toBe(
        '200'
      );
    });
  });

  describe('current value', () => {
    it('should compute quantity × currentPrice with exact decimal arithmetic', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '0.1',
          price: '0.2',
          assetCurrentPrice: '0.2'
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions[0].currentPrice).toBe('0.2');
      expect(result.positions[0].currentValue).toBe('0.02');
      expect(result.positions[0].currentValue).not.toBe('0.020000000000000004');
    });
  });

  describe('unrealized P&L', () => {
    it('should compute positive unrealized P&L', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          assetCurrentPrice: '150'
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions[0].currentValue).toBe('150');
      expect(result.positions[0].unrealizedPnl).toBe('50');
      expect(result.positions[0].totalPnl).toBe('50');
    });

    it('should compute negative unrealized P&L as a signed decimal', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          assetCurrentPrice: '50'
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions[0].currentValue).toBe('50');
      expect(result.positions[0].unrealizedPnl).toBe('-50');
      expect(result.positions[0].totalPnl).toBe('-50');
    });

    it('should compute zero unrealized P&L', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '50',
          assetCurrentPrice: '50'
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions[0].unrealizedPnl).toBe('0');
      expect(result.positions[0].totalPnl).toBe('0');
    });
  });

  describe('realized P&L', () => {
    it('should return realized events and sum them exactly', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          type: PortfolioTransactionType.SELL,
          amount: '1',
          price: '150',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');
      const position = result.positions[0];

      expect(position.quantity).toBe('0');
      expect(position.totalCost).toBe('0');
      expect(position.realizedPnl).toBe('50');
      expect(position.realizedPnlEvents).toHaveLength(1);
      expect(position.realizedPnlEvents[0]).toEqual({
        transactionId: 't2',
        occurredAt: '2026-01-02T00:00:00.000Z',
        type: CalculationTransactionType.SELL,
        amount: '1',
        price: '150',
        proceeds: '150',
        releasedCostBasis: '100',
        realizedPnl: '50'
      });
    });

    it('should emit only SELL events across a mixed ledger', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          type: PortfolioTransactionType.TRANSFER_IN,
          amount: '1',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          amount: '1',
          price: '100',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't3',
          type: PortfolioTransactionType.TRANSFER_OUT,
          amount: '1',
          occurredAt: new Date('2026-01-03T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't4',
          type: PortfolioTransactionType.SELL,
          amount: '1',
          price: '150',
          occurredAt: new Date('2026-01-04T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions[0].realizedPnlEvents).toHaveLength(1);
      expect(result.positions[0].realizedPnlEvents[0]).toMatchObject({
        transactionId: 't4',
        type: CalculationTransactionType.SELL
      });
    });

    it('should not realize P&L for a TRANSFER_OUT', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          type: PortfolioTransactionType.TRANSFER_IN,
          amount: '1',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          type: PortfolioTransactionType.TRANSFER_OUT,
          amount: '1',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');
      const position = result.positions[0];

      expect(position.quantity).toBe('0');
      expect(position.realizedPnl).toBe('0');
      expect(position.realizedPnlEvents).toEqual([]);
    });
  });

  describe('missing current price', () => {
    it('should report nulls and keep realized P&L available', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          assetCurrentPrice: null,
          amount: '1',
          price: '100',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          assetCurrentPrice: null,
          type: PortfolioTransactionType.SELL,
          amount: '1',
          price: '150',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');
      const position = result.positions[0];

      expect(position.currentPrice).toBeNull();
      expect(position.currentValue).toBeNull();
      expect(position.unrealizedPnl).toBeNull();
      expect(position.totalPnl).toBeNull();
      expect(position.realizedPnl).toBe('50');

      expect(result).toMatchObject({
        totalCurrentValue: null,
        totalUnrealizedPnl: null,
        totalPnl: null,
        totalRealizedPnl: '50',
        pricedPositions: 0,
        unpricedPositions: 1
      });
    });

    it('should invalidate portfolio totals when any position is unpriced', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          assetCurrentPrice: '100'
        }),
        makeTransaction({
          id: 't2',
          assetId: 'asset-2',
          assetCurrentPrice: null
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions).toHaveLength(2);
      expect(result.positions[0].currentValue).toBe('100');
      expect(result.positions[1].currentValue).toBeNull();
      expect(result).toMatchObject({
        totalCurrentValue: null,
        totalUnrealizedPnl: null,
        totalPnl: null,
        totalRealizedPnl: '0',
        totalCostBasis: '200',
        pricedPositions: 1,
        unpricedPositions: 1
      });
    });
  });

  describe('multi-asset portfolios', () => {
    it('should calculate each asset independently without cross-contamination', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          assetId: 'asset-1',
          amount: '2',
          price: '50000',
          assetCurrentPrice: '60000',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          assetId: 'asset-2',
          amount: '3',
          price: '2000',
          assetCurrentPrice: '2500',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions).toHaveLength(2);
      expect(result.positions[0]).toMatchObject({
        assetId: 'asset-1',
        symbol: 'btc',
        quantity: '2',
        totalCost: '100000',
        currentValue: '120000',
        unrealizedPnl: '20000'
      });
      expect(result.positions[1]).toMatchObject({
        assetId: 'asset-2',
        symbol: 'eth',
        quantity: '3',
        totalCost: '6000',
        currentValue: '7500',
        unrealizedPnl: '1500'
      });
      expect(result).toMatchObject({
        totalCurrentValue: '127500',
        totalCostBasis: '106000',
        totalUnrealizedPnl: '21500',
        totalPnl: '21500'
      });
    });
  });

  describe('zero remaining quantity', () => {
    it('should retain realized P&L after a full sell-out', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          type: PortfolioTransactionType.SELL,
          amount: '1',
          price: '150',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');
      const position = result.positions[0];

      expect(position.quantity).toBe('0');
      expect(position.totalCost).toBe('0');
      expect(position.currentValue).toBe('0');
      expect(position.unrealizedPnl).toBe('0');
      expect(position.realizedPnl).toBe('50');
      expect(position.totalPnl).toBe('50');
    });
  });

  describe('decimal aggregation', () => {
    it('should sum multiple position values exactly', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '0.5',
          price: '60000',
          assetCurrentPrice: '60000'
        }),
        makeTransaction({
          id: 't2',
          assetId: 'asset-2',
          amount: '0.1',
          price: '0.2',
          assetCurrentPrice: '0.3'
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions[1].currentValue).toBe('0.03');
      expect(result.positions[1].unrealizedPnl).toBe('0.01');
      expect(result.totalCurrentValue).toBe('30000.03');
      expect(result.totalUnrealizedPnl).toBe('0.01');
      expect(result.totalPnl).toBe('0.01');
    });

    it('should keep negative unrealized P&L signed in the totals', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          assetCurrentPrice: '50',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          assetId: 'asset-2',
          amount: '1',
          price: '200',
          assetCurrentPrice: '300',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions[0].unrealizedPnl).toBe('-50');
      expect(result.positions[1].unrealizedPnl).toBe('100');
      expect(result.totalUnrealizedPnl).toBe('50');
      expect(result.totalPnl).toBe('50');
    });

    it('should combine signed realized and unrealized P&L in the total', async () => {
      useRealEngine();
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          type: PortfolioTransactionType.SELL,
          amount: '1',
          price: '150',
          assetCurrentPrice: '50',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't3',
          assetId: 'asset-2',
          amount: '1',
          price: '100',
          assetCurrentPrice: '150',
          occurredAt: new Date('2026-01-03T00:00:00.000Z')
        })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(result.positions[0].realizedPnl).toBe('50');
      expect(result.positions[0].unrealizedPnl).toBe('0');
      expect(result.positions[0].totalPnl).toBe('50');
      expect(result.positions[1].unrealizedPnl).toBe('50');
      expect(result.totalRealizedPnl).toBe('50');
      expect(result.totalUnrealizedPnl).toBe('50');
      expect(result.totalPnl).toBe('100');
    });
  });

  describe('input immutability', () => {
    it('should not mutate repository results or transaction arrays', async () => {
      const transactions = deepFreeze([
        makeTransaction({
          id: 't1',
          amount: '1',
          price: '100',
          occurredAt: new Date('2026-01-01T00:00:00.000Z')
        }),
        makeTransaction({
          id: 't2',
          type: PortfolioTransactionType.SELL,
          amount: '1',
          price: '150',
          occurredAt: new Date('2026-01-02T00:00:00.000Z')
        })
      ]);
      transactionRepository.listForPnl.mockResolvedValue(transactions);

      await expect(
        useCase.execute('user-id', 'portfolio-id')
      ).resolves.toBeDefined();

      expect(transactionRepository.listForPnl).toHaveBeenCalledWith(
        'portfolio-id',
        'user-id'
      );
    });

    it('should work with a mocked engine result without touching the ledger', async () => {
      const calculate = engineReturns({
        quantity: '1',
        totalCost: '100',
        averageCost: '100',
        realizedPnl: []
      });
      transactionRepository.listForPnl.mockResolvedValue([
        makeTransaction({ assetCurrentPrice: '200' })
      ]);

      const result = await useCase.execute('user-id', 'portfolio-id');

      expect(calculate).toHaveBeenCalledWith(
        {
          assetId: 'asset-1',
          openingQuantity: '0',
          openingCost: '0',
          transactions: [
            expect.objectContaining({
              id: 'tx-1',
              type: CalculationTransactionType.BUY,
              amount: '1',
              price: '100',
              occurredAt: '2026-01-01T00:00:00.000Z'
            })
          ]
        },
        { alreadyOrdered: true, trustedIsoDates: true }
      );
      expect(result.positions[0]).toMatchObject({
        quantity: '1',
        totalCost: '100',
        currentValue: '200',
        unrealizedPnl: '100'
      });
    });
  });
});
