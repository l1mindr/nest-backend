import { ClockService } from '@infrastructure/clock/clock.service';
import { AssetErrorCode } from '../../../domain/errors/asset-error-code.enum';
import { SyncAssetsFromCoinGeckoUseCase } from '../sync-assets-from-coingecko.use-case';

describe('SyncAssetsFromCoinGeckoUseCase', () => {
  const now = new Date('2026-07-28T08:00:00.000Z');
  const coingeckoPort = {
    fetchMarketData: jest.fn()
  };
  const assetRepository = {
    upsertMany: jest.fn()
  };
  const clockService = {
    nowDate: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  let useCase: SyncAssetsFromCoinGeckoUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    clockService.nowDate.mockReturnValue(now);

    useCase = new SyncAssetsFromCoinGeckoUseCase(
      coingeckoPort as any,
      assetRepository as any,
      clockService as unknown as ClockService,
      logger as any
    );
  });

  it('should fetch and sync assets from CoinGecko', async () => {
    coingeckoPort.fetchMarketData.mockResolvedValue([
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        image: 'https://example.com/bitcoin.png',
        current_price: 120000,
        market_cap: 2400000000000,
        market_cap_rank: 1,
        total_volume: 50000000000,
        circulating_supply: 20000000,
        total_supply: 21000000,
        max_supply: 21000000,
        price_change_24h: 1000,
        price_change_percentage_24h: 2.5
      }
    ]);

    const result = await useCase.execute();

    expect(coingeckoPort.fetchMarketData).toHaveBeenCalledTimes(1);
    expect(assetRepository.upsertMany).toHaveBeenCalledWith([
      {
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://example.com/bitcoin.png',
        currentPrice: '120000',
        marketCap: '2400000000000',
        marketCapRank: 1,
        totalVolume: '50000000000',
        circulatingSupply: '20000000',
        totalSupply: '21000000',
        maxSupply: '21000000',
        priceChange24h: '1000',
        priceChangePercentage24h: '2.5',
        lastSyncedAt: now
      }
    ]);
    expect(result).toEqual({
      receivedCount: 1,
      synchronizedCount: 1
    });
  });

  it('should normalize coinGeckoId/symbol to lowercase and trim name', async () => {
    coingeckoPort.fetchMarketData.mockResolvedValue([
      {
        id: '  BITCOIN  ',
        symbol: '  BTC  ',
        name: '  Bitcoin  '
      }
    ]);

    await useCase.execute();

    expect(assetRepository.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin'
      })
    ]);
  });

  it('should skip items with missing required fields', async () => {
    coingeckoPort.fetchMarketData.mockResolvedValue([
      { symbol: 'btc', name: 'Bitcoin' },
      { id: 'ethereum', name: 'Ethereum' },
      { id: 'solana', symbol: 'sol' },
      { id: 123, symbol: 'bad', name: 'Bad' },
      { id: 'cardano', symbol: 'ADA', name: 'Cardano' }
    ]);

    await useCase.execute();

    expect(assetRepository.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        coinGeckoId: 'cardano',
        symbol: 'ada',
        name: 'Cardano'
      })
    ]);
  });

  it('should coerce numeric fields to string|null', async () => {
    coingeckoPort.fetchMarketData.mockResolvedValue([
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        current_price: 120000,
        market_cap: Number.POSITIVE_INFINITY,
        market_cap_rank: 1,
        total_volume: Number.NaN,
        max_supply: undefined,
        price_change_24h: -150.5,
        price_change_percentage_24h: null
      }
    ]);

    await useCase.execute();

    expect(assetRepository.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        currentPrice: '120000',
        marketCap: null,
        marketCapRank: 1,
        totalVolume: null,
        maxSupply: null,
        priceChange24h: '-150.5',
        priceChangePercentage24h: null
      })
    ]);
  });

  it('should throw COINGECKO_API_ERROR when fetchMarketData fails', async () => {
    coingeckoPort.fetchMarketData.mockRejectedValue(
      new Error('connection refused')
    );

    await expect(useCase.execute()).rejects.toMatchObject({
      code: AssetErrorCode.COINGECKO_API_ERROR
    });

    expect(assetRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('should throw ASSET_SYNC_EMPTY_RESPONSE when no valid assets remain', async () => {
    coingeckoPort.fetchMarketData.mockResolvedValue([
      { symbol: 'btc', name: 'Bitcoin' },
      { id: '', symbol: '', name: '' }
    ]);

    await expect(useCase.execute()).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_SYNC_EMPTY_RESPONSE
    });

    expect(assetRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('should set lastSyncedAt to clockService.nowDate()', async () => {
    const later = new Date('2026-07-28T09:30:00.000Z');
    clockService.nowDate.mockReturnValue(later);
    coingeckoPort.fetchMarketData.mockResolvedValue([
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' }
    ]);

    await useCase.execute();

    expect(clockService.nowDate).toHaveBeenCalledTimes(1);
    expect(assetRepository.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({ lastSyncedAt: later })
    ]);
  });

  it('should deduplicate by coinGeckoId', async () => {
    coingeckoPort.fetchMarketData.mockResolvedValue([
      {
        id: 'BITCOIN',
        symbol: 'BTC',
        name: 'Bitcoin'
      },
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin Updated',
        current_price: 130000
      }
    ]);

    await useCase.execute();

    expect(assetRepository.upsertMany).toHaveBeenCalledTimes(1);
    expect(assetRepository.upsertMany).toHaveBeenCalledWith([
      {
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin Updated',
        imageUrl: null,
        currentPrice: '130000',
        marketCap: null,
        marketCapRank: null,
        totalVolume: null,
        circulatingSupply: null,
        totalSupply: null,
        maxSupply: null,
        priceChange24h: null,
        priceChangePercentage24h: null,
        lastSyncedAt: now
      }
    ]);
  });
});
