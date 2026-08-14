import { AssetResponseDto } from '@features/assets/presentation/dto/response/asset.response.dto';
import { Asset } from '@features/assets/domain/entities/asset.entity';
import { PortfolioOpeningBalance } from '../../../domain/entities/portfolio-opening-balance.entity';
import { PortfolioOpeningBalanceMapper } from '../portfolio-opening-balance.mapper';

describe('PortfolioOpeningBalanceMapper', () => {
  const mapper = new PortfolioOpeningBalanceMapper();

  function makeAsset(overrides: Partial<Asset> = {}): Asset {
    return {
      id: 'asset-id',
      coinGeckoId: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      imageUrl: null,
      currentPrice: '60000',
      marketCap: '1200000000000',
      marketCapRank: 1,
      totalVolume: '30000000000',
      circulatingSupply: '19000000',
      totalSupply: '21000000',
      maxSupply: '21000000',
      priceChange24h: '500',
      priceChangePercentage24h: '0.8',
      lastSyncedAt: new Date('2026-07-28T08:00:00.000Z'),
      createdAt: new Date('2026-07-28T08:00:00.000Z'),
      updatedAt: new Date('2026-07-28T08:00:00.000Z'),
      ...overrides
    } as Asset;
  }

  function makeOpeningBalance(
    overrides: Partial<PortfolioOpeningBalance> = {}
  ): PortfolioOpeningBalance {
    return {
      id: 'opening-balance-id',
      userId: 'user-id',
      portfolioId: 'portfolio-id',
      assetId: 'asset-id',
      openingQuantity: '1.500000000000000000',
      openingCost: '90000.00000000000000000000000000',
      createdAt: new Date('2026-07-28T08:00:00.000Z'),
      updatedAt: new Date('2026-07-28T08:00:00.000Z'),
      asset: makeAsset(),
      ...overrides
    } as PortfolioOpeningBalance;
  }

  it('should preserve the decimal strings exactly', () => {
    const dto = mapper.toResponse(
      makeOpeningBalance({
        openingQuantity: '0.000000000000000001',
        openingCost: '12345.67890123456789012345678901'
      })
    );

    expect(dto.openingQuantity).toBe('0.000000000000000001');
    expect(dto.openingCost).toBe('12345.67890123456789012345678901');
  });

  it('should expose the public fields and drop internal ones', () => {
    const dto = mapper.toResponse(makeOpeningBalance());

    expect(dto).toEqual(
      expect.objectContaining({
        id: 'opening-balance-id',
        portfolioId: 'portfolio-id',
        assetId: 'asset-id',
        openingQuantity: '1.500000000000000000',
        openingCost: '90000.00000000000000000000000000',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    );
    expect(dto).not.toHaveProperty('userId');
    expect(dto).not.toHaveProperty('owner');
    expect(dto).not.toHaveProperty('portfolio');
  });

  it('should map the nested asset to an asset response DTO', () => {
    const dto = mapper.toResponse(makeOpeningBalance());

    expect(dto.asset).toBeInstanceOf(AssetResponseDto);
    expect(dto.asset).toEqual(
      expect.objectContaining({
        id: 'asset-id',
        symbol: 'btc',
        name: 'Bitcoin'
      })
    );
  });

  it('should map a list of opening balances', () => {
    const list = mapper.toResponseList([
      makeOpeningBalance(),
      makeOpeningBalance({
        id: 'opening-balance-2',
        openingQuantity: '2'
      })
    ]);

    expect(list).toHaveLength(2);
    expect(list[1].id).toBe('opening-balance-2');
    expect(list[1].openingQuantity).toBe('2');
  });
});
