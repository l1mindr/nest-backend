import { Holding } from '../../../domain/entities/holding.entity';
import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioValuationStatus } from '../../../domain/enums/portfolio-valuation-status.enum';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { GetPortfolioValuationUseCase } from '../get-portfolio-valuation.use-case';

describe('GetPortfolioValuationUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'My Ledger'
  } as Portfolio;

  const holdingRepository = {
    listForValuation: jest.fn()
  };
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  function makeHolding(
    id: string,
    amount: string,
    currentPrice: string | null
  ): Holding {
    return {
      id,
      assetId: `asset-${id}`,
      amount,
      asset: {
        id: `asset-${id}`,
        symbol: 'btc',
        name: 'Bitcoin',
        currentPrice
      }
    } as Holding;
  }

  let useCase: GetPortfolioValuationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    holdingRepository.listForValuation.mockResolvedValue([]);

    useCase = new GetPortfolioValuationUseCase(
      portfolioRepository as any,
      holdingRepository as any,
      logger as any
    );
  });

  it('should value every holding and report a COMPLETE portfolio', async () => {
    holdingRepository.listForValuation.mockResolvedValue([
      makeHolding('h1', '1.500000000000000000', '60000.00000000'),
      makeHolding('h2', '2.000000000000000000', '3000.00000000')
    ]);

    const result = await useCase.execute('user-id', 'portfolio-id');

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(holdingRepository.listForValuation).toHaveBeenCalledWith(
      'portfolio-id'
    );
    expect(result).toMatchObject({
      portfolioId: 'portfolio-id',
      currency: 'USD',
      status: PortfolioValuationStatus.COMPLETE,
      totalValue: '96000',
      valuedHoldings: 2,
      unvaluedHoldings: 0
    });
    expect(result.holdings).toEqual([
      expect.objectContaining({
        holdingId: 'h1',
        amount: '1.500000000000000000',
        currentPrice: '60000.00000000',
        value: '90000'
      }),
      expect.objectContaining({
        holdingId: 'h2',
        value: '6000'
      })
    ]);
  });

  it('should exclude unvalued holdings from the total and report PARTIAL', async () => {
    holdingRepository.listForValuation.mockResolvedValue([
      makeHolding('h1', '1.5', '60000'),
      makeHolding('h2', '2', null)
    ]);

    const result = await useCase.execute('user-id', 'portfolio-id');

    expect(result).toMatchObject({
      status: PortfolioValuationStatus.PARTIAL,
      totalValue: '90000',
      valuedHoldings: 1,
      unvaluedHoldings: 1
    });
    expect(result.holdings).toEqual([
      expect.objectContaining({ holdingId: 'h1', value: '90000' }),
      expect.objectContaining({ holdingId: 'h2', value: null })
    ]);
  });

  it('should report UNAVAILABLE when no holding has a price', async () => {
    holdingRepository.listForValuation.mockResolvedValue([
      makeHolding('h1', '1.5', null)
    ]);

    const result = await useCase.execute('user-id', 'portfolio-id');

    expect(result).toMatchObject({
      status: PortfolioValuationStatus.UNAVAILABLE,
      totalValue: null,
      valuedHoldings: 0,
      unvaluedHoldings: 1
    });
  });

  it('should report EMPTY for a portfolio with no holdings', async () => {
    const result = await useCase.execute('user-id', 'portfolio-id');

    expect(result).toMatchObject({
      status: PortfolioValuationStatus.EMPTY,
      totalValue: null,
      valuedHoldings: 0,
      unvaluedHoldings: 0,
      holdings: []
    });
  });

  it('should value with exact decimal arithmetic', async () => {
    holdingRepository.listForValuation.mockResolvedValue([
      makeHolding('h1', '0.100000000000000000', '0.20000000')
    ]);

    const result = await useCase.execute('user-id', 'portfolio-id');

    expect(result.holdings[0].value).toBe('0.02');
    expect(result.totalValue).toBe('0.02');
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'foreign-portfolio')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(holdingRepository.listForValuation).not.toHaveBeenCalled();
  });
});
