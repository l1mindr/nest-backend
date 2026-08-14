import { AssetResponseDto } from '@features/assets/presentation/dto/response/asset.response.dto';
import { Asset } from '@features/assets/domain/entities/asset.entity';
import { Holding } from '../../../domain/entities/holding.entity';
import { HoldingMapper } from '../holding.mapper';

describe('HoldingMapper', () => {
  const mapper = new HoldingMapper();

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

  function makeHolding(overrides: Partial<Holding> = {}): Holding {
    return {
      id: 'holding-id',
      userId: 'user-id',
      portfolioId: 'portfolio-id',
      assetId: 'asset-id',
      amount: '1.500000000000000000',
      notes: 'Cold storage',
      createdAt: new Date('2026-07-28T08:00:00.000Z'),
      updatedAt: new Date('2026-07-28T08:00:00.000Z'),
      asset: makeAsset(),
      ...overrides
    } as Holding;
  }

  it('should preserve the decimal amount string exactly', () => {
    const dto = mapper.toResponse(
      makeHolding({ amount: '0.000000000000000001' })
    );

    expect(dto.amount).toBe('0.000000000000000001');
  });

  it('should expose the public fields and drop internal ones', () => {
    const dto = mapper.toResponse(makeHolding());

    expect(dto).toEqual(
      expect.objectContaining({
        id: 'holding-id',
        portfolioId: 'portfolio-id',
        assetId: 'asset-id',
        amount: '1.500000000000000000',
        notes: 'Cold storage',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    );
    expect(dto).not.toHaveProperty('userId');
    expect(dto).not.toHaveProperty('owner');
    expect(dto).not.toHaveProperty('portfolio');
  });

  it('should map the nested asset to an asset response DTO', () => {
    const dto = mapper.toResponse(makeHolding());

    expect(dto.asset).toBeInstanceOf(AssetResponseDto);
    expect(dto.asset).toEqual(
      expect.objectContaining({
        id: 'asset-id',
        symbol: 'btc',
        name: 'Bitcoin',
        currentPrice: '60000'
      })
    );
  });

  it('should map a null note unchanged', () => {
    const dto = mapper.toResponse(makeHolding({ notes: null }));

    expect(dto.notes).toBeNull();
  });

  it('should map a list of holdings', () => {
    const list = mapper.toResponseList([
      makeHolding(),
      makeHolding({ id: 'holding-2', amount: '2' })
    ]);

    expect(list).toHaveLength(2);
    expect(list[1].id).toBe('holding-2');
    expect(list[1].amount).toBe('2');
  });
});
