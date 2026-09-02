import { DerivedHolding } from '../../interfaces/portfolio.interface';
import { ListHoldingsUseCase } from '../list-holdings.use-case';

describe('ListHoldingsUseCase', () => {
  const portfolioRepository = {
    findByUserId: jest.fn()
  };

  const holdingsService = {
    getPortfolioHoldings: jest.fn()
  };

  const derived = (
    overrides: Partial<DerivedHolding> & { assetId: string; amount: string }
  ): DerivedHolding =>
    ({
      id: `holding-${overrides.assetId}`,
      portfolioId: 'portfolio-id',
      notes: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      asset: { id: overrides.assetId, symbol: 'btc', name: 'Bitcoin' },
      ...overrides
    }) as DerivedHolding;

  let useCase: ListHoldingsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListHoldingsUseCase(
      portfolioRepository as never,
      holdingsService as never
    );
  });

  it('derives holdings for the requested portfolio', async () => {
    holdingsService.getPortfolioHoldings.mockResolvedValue([
      derived({ assetId: 'asset-id', amount: '10' })
    ]);

    const result = await useCase.execute('user-id', {
      portfolioId: 'portfolio-id'
    });

    expect(holdingsService.getPortfolioHoldings).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(portfolioRepository.findByUserId).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe('10');
  });

  it('derives every portfolio the user owns when no filter is given', async () => {
    portfolioRepository.findByUserId.mockResolvedValue([
      { id: 'portfolio-a' },
      { id: 'portfolio-b' }
    ]);
    holdingsService.getPortfolioHoldings
      .mockResolvedValueOnce([derived({ assetId: 'asset-a', amount: '1' })])
      .mockResolvedValueOnce([derived({ assetId: 'asset-b', amount: '2' })]);

    const result = await useCase.execute('user-id', {});

    expect(holdingsService.getPortfolioHoldings).toHaveBeenCalledWith(
      'portfolio-a',
      'user-id'
    );
    expect(holdingsService.getPortfolioHoldings).toHaveBeenCalledWith(
      'portfolio-b',
      'user-id'
    );
    expect(result.map((holding) => holding.assetId)).toEqual([
      'asset-a',
      'asset-b'
    ]);
  });

  it('omits positions the user has fully exited', async () => {
    holdingsService.getPortfolioHoldings.mockResolvedValue([
      derived({ assetId: 'held', amount: '3' }),
      derived({ assetId: 'exited', amount: '0' }),
      derived({ assetId: 'exited-scaled', amount: '0.000000000000000000' })
    ]);

    const result = await useCase.execute('user-id', {
      portfolioId: 'portfolio-id'
    });

    expect(result.map((holding) => holding.assetId)).toEqual(['held']);
  });

  it('keeps sub-unit positions that are not zero', async () => {
    holdingsService.getPortfolioHoldings.mockResolvedValue([
      derived({ assetId: 'dust', amount: '0.000000000000000001' })
    ]);

    const result = await useCase.execute('user-id', {
      portfolioId: 'portfolio-id'
    });

    expect(result).toHaveLength(1);
  });
});
