import {
  PortfolioHoldingValuation,
  PortfolioValuation
} from '../../interfaces/portfolio.interface';
import { PortfolioValuationMapper } from '../portfolio-valuation.mapper';
import { PortfolioValuationStatus } from '../../../domain/enums/portfolio-valuation-status.enum';

describe('PortfolioValuationMapper', () => {
  const mapper = new PortfolioValuationMapper();

  function makeHoldingValuation(
    overrides: Partial<PortfolioHoldingValuation> = {}
  ): PortfolioHoldingValuation {
    return {
      holdingId: 'holding-id',
      assetId: 'asset-id',
      symbol: 'btc',
      name: 'Bitcoin',
      amount: '1.5',
      currentPrice: '60000',
      value: '90000',
      ...overrides
    };
  }

  function makeValuation(
    overrides: Partial<PortfolioValuation> = {}
  ): PortfolioValuation {
    return {
      portfolioId: 'portfolio-id',
      currency: 'USD',
      totalValue: '90000',
      status: PortfolioValuationStatus.COMPLETE,
      valuedHoldings: 1,
      unvaluedHoldings: 0,
      holdings: [makeHoldingValuation()],
      ...overrides
    };
  }

  it('should map every field of the valuation', () => {
    const dto = mapper.toResponse(makeValuation());

    expect(dto).toEqual(
      expect.objectContaining({
        portfolioId: 'portfolio-id',
        currency: 'USD',
        totalValue: '90000',
        status: PortfolioValuationStatus.COMPLETE,
        valuedHoldings: 1,
        unvaluedHoldings: 0
      })
    );
  });

  it('should preserve null total value', () => {
    const dto = mapper.toResponse(
      makeValuation({
        totalValue: null,
        status: PortfolioValuationStatus.UNAVAILABLE
      })
    );

    expect(dto.totalValue).toBeNull();
    expect(dto.status).toBe(PortfolioValuationStatus.UNAVAILABLE);
  });

  it('should map the per-holding valuation lines', () => {
    const dto = mapper.toResponse(
      makeValuation({
        valuedHoldings: 2,
        unvaluedHoldings: 1,
        holdings: [
          makeHoldingValuation(),
          makeHoldingValuation({
            holdingId: 'holding-2',
            symbol: 'eth',
            name: 'Ethereum',
            currentPrice: null,
            value: null
          })
        ]
      })
    );

    expect(dto.holdings).toHaveLength(2);
    expect(dto.holdings[0]).toEqual(
      expect.objectContaining({
        holdingId: 'holding-id',
        assetId: 'asset-id',
        symbol: 'btc',
        amount: '1.5',
        currentPrice: '60000',
        value: '90000'
      })
    );
    expect(dto.holdings[1].currentPrice).toBeNull();
    expect(dto.holdings[1].value).toBeNull();
  });
});
