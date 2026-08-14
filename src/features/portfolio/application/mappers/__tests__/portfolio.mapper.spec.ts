import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioSourceType } from '../../../domain/enums/portfolio-source-type.enum';
import { PortfolioMapper } from '../portfolio.mapper';

describe('PortfolioMapper', () => {
  const mapper = new PortfolioMapper();

  function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
    return {
      id: 'portfolio-id',
      userId: 'user-id',
      name: 'My Ledger',
      sourceType: PortfolioSourceType.WALLET,
      walletAddress: '0x1234',
      createdAt: new Date('2026-07-28T08:00:00.000Z'),
      updatedAt: new Date('2026-07-28T08:00:00.000Z'),
      ...overrides
    } as Portfolio;
  }

  it('should expose the public fields and drop internal ones', () => {
    const dto = mapper.toResponse(makePortfolio());

    expect(dto).toEqual({
      id: 'portfolio-id',
      name: 'My Ledger',
      sourceType: PortfolioSourceType.WALLET,
      walletAddress: '0x1234',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
    expect(dto).not.toHaveProperty('userId');
    expect(dto).not.toHaveProperty('owner');
  });

  it('should map a null wallet address unchanged', () => {
    const dto = mapper.toResponse(makePortfolio({ walletAddress: null }));

    expect(dto.walletAddress).toBeNull();
  });

  it('should map a list of portfolios', () => {
    const list = mapper.toResponseList([
      makePortfolio(),
      makePortfolio({
        name: 'Second',
        sourceType: PortfolioSourceType.EXCHANGE
      })
    ]);

    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('My Ledger');
    expect(list[1]).toEqual(
      expect.objectContaining({
        name: 'Second',
        sourceType: PortfolioSourceType.EXCHANGE
      })
    );
    expect(list[0]).not.toHaveProperty('userId');
  });
});
