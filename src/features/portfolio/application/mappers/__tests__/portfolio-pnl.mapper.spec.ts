import {
  PortfolioPnlPosition,
  PortfolioPnlResult
} from '../../interfaces/portfolio.interface';
import { PortfolioPnlMapper } from '../portfolio-pnl.mapper';
import { CostBasisStrategy } from '../../../domain/calculation/types/cost-basis.strategy.enum';
import { CalculationTransactionType } from '../../../domain/calculation/types/calculation-transaction.types';

describe('PortfolioPnlMapper', () => {
  const mapper = new PortfolioPnlMapper();

  function makePosition(
    overrides: Partial<PortfolioPnlPosition> = {}
  ): PortfolioPnlPosition {
    return {
      assetId: 'asset-id',
      symbol: 'btc',
      name: 'Bitcoin',
      quantity: '1',
      totalCost: '50000',
      averageCost: '50000',
      currentPrice: '60000',
      currentValue: '60000',
      realizedPnl: '5000',
      unrealizedPnl: '10000',
      totalPnl: '15000',
      realizedPnlEvents: [
        {
          occurredAt: '2026-07-02T08:00:00.000Z',
          type: CalculationTransactionType.SELL,
          amount: '0.5',
          price: '60000',
          proceeds: '30000',
          releasedCostBasis: '25000',
          realizedPnl: '5000'
        }
      ],
      ...overrides
    };
  }

  function makeResult(
    overrides: Partial<PortfolioPnlResult> = {}
  ): PortfolioPnlResult {
    return {
      portfolioId: 'portfolio-id',
      currency: 'USD',
      costBasisStrategy: CostBasisStrategy.AVERAGE,
      pricedPositions: 1,
      unpricedPositions: 0,
      totalCurrentValue: '60000',
      totalCostBasis: '50000',
      totalRealizedPnl: '5000',
      totalUnrealizedPnl: '10000',
      totalPnl: '15000',
      positions: [makePosition()],
      ...overrides
    };
  }

  it('should map the cost basis strategy to the costBasis field', () => {
    const dto = mapper.toResponse(
      makeResult({ costBasisStrategy: CostBasisStrategy.FIFO })
    );

    expect(dto.costBasis).toBe(CostBasisStrategy.FIFO);
    expect(dto).not.toHaveProperty('costBasisStrategy');
  });

  it('should map every aggregate field', () => {
    const dto = mapper.toResponse(makeResult());

    expect(dto).toEqual(
      expect.objectContaining({
        portfolioId: 'portfolio-id',
        currency: 'USD',
        pricedPositions: 1,
        unpricedPositions: 0,
        totalCurrentValue: '60000',
        totalCostBasis: '50000',
        totalRealizedPnl: '5000',
        totalUnrealizedPnl: '10000',
        totalPnl: '15000'
      })
    );
  });

  it('should pass null aggregates through unchanged', () => {
    const dto = mapper.toResponse(
      makeResult({
        totalCurrentValue: null,
        totalUnrealizedPnl: null,
        totalPnl: null
      })
    );

    expect(dto.totalCurrentValue).toBeNull();
    expect(dto.totalUnrealizedPnl).toBeNull();
    expect(dto.totalPnl).toBeNull();
    expect(dto.totalRealizedPnl).toBe('5000');
  });

  it('should map the positions and their realized P&L events', () => {
    const dto = mapper.toResponse(makeResult());

    expect(dto.positions).toHaveLength(1);
    expect(dto.positions[0]).toEqual(
      expect.objectContaining({
        assetId: 'asset-id',
        symbol: 'btc',
        quantity: '1',
        totalCost: '50000',
        averageCost: '50000',
        currentValue: '60000',
        realizedPnl: '5000',
        unrealizedPnl: '10000',
        totalPnl: '15000'
      })
    );
    expect(dto.positions[0].realizedPnlEvents[0]).toEqual(
      expect.objectContaining({
        type: CalculationTransactionType.SELL,
        amount: '0.5',
        proceeds: '30000',
        releasedCostBasis: '25000',
        realizedPnl: '5000'
      })
    );
  });
});
