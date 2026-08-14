import { AssetResponseDto } from '@features/assets/presentation/dto/response/asset.response.dto';
import { Asset } from '@features/assets/domain/entities/asset.entity';
import { PortfolioTransaction } from '../../../domain/entities/portfolio-transaction.entity';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { PortfolioTransactionMapper } from '../portfolio-transaction.mapper';

describe('PortfolioTransactionMapper', () => {
  const mapper = new PortfolioTransactionMapper();

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

  function makeTransaction(
    overrides: Partial<PortfolioTransaction> = {}
  ): PortfolioTransaction {
    return {
      id: 'transaction-id',
      userId: 'user-id',
      portfolioId: 'portfolio-id',
      assetId: 'asset-id',
      type: PortfolioTransactionType.BUY,
      amount: '0.500000000000000000',
      price: '60000.50000000',
      fee: '0.75000000',
      occurredAt: new Date('2026-07-28T08:00:00.000Z'),
      notes: 'Dollar-cost average',
      createdAt: new Date('2026-07-28T08:00:00.000Z'),
      updatedAt: new Date('2026-07-28T08:00:00.000Z'),
      asset: makeAsset(),
      ...overrides
    } as PortfolioTransaction;
  }

  it('should preserve decimal strings exactly', () => {
    const dto = mapper.toResponse(
      makeTransaction({
        amount: '0.000000000000000001',
        price: '60000.00000001',
        fee: '0'
      })
    );

    expect(dto.amount).toBe('0.000000000000000001');
    expect(dto.price).toBe('60000.00000001');
    expect(dto.fee).toBe('0');
  });

  it('should expose the public fields and drop internal ones', () => {
    const dto = mapper.toResponse(makeTransaction());

    expect(dto).toEqual(
      expect.objectContaining({
        id: 'transaction-id',
        portfolioId: 'portfolio-id',
        assetId: 'asset-id',
        type: PortfolioTransactionType.BUY,
        amount: '0.500000000000000000',
        price: '60000.50000000',
        fee: '0.75000000',
        occurredAt: expect.any(Date),
        notes: 'Dollar-cost average',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    );
    expect(dto).not.toHaveProperty('userId');
    expect(dto).not.toHaveProperty('owner');
    expect(dto).not.toHaveProperty('portfolio');
  });

  it('should map the nested asset to an asset response DTO', () => {
    const dto = mapper.toResponse(makeTransaction());

    expect(dto.asset).toBeInstanceOf(AssetResponseDto);
    expect(dto.asset).toEqual(
      expect.objectContaining({
        id: 'asset-id',
        symbol: 'btc',
        name: 'Bitcoin'
      })
    );
  });

  it('should map null price, fee, and notes unchanged', () => {
    const dto = mapper.toResponse(
      makeTransaction({
        type: PortfolioTransactionType.TRANSFER_IN,
        price: null,
        fee: null,
        notes: null
      })
    );

    expect(dto.type).toBe(PortfolioTransactionType.TRANSFER_IN);
    expect(dto.price).toBeNull();
    expect(dto.fee).toBeNull();
    expect(dto.notes).toBeNull();
  });

  it('should map a list of transactions', () => {
    const list = mapper.toResponseList([
      makeTransaction(),
      makeTransaction({
        id: 'transaction-2',
        type: PortfolioTransactionType.SELL,
        price: '61000.00000000'
      })
    ]);

    expect(list).toHaveLength(2);
    expect(list[1].id).toBe('transaction-2');
    expect(list[1].type).toBe(PortfolioTransactionType.SELL);
    expect(list[1].price).toBe('61000.00000000');
  });
});
