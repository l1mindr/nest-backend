import { ClockService } from '@infrastructure/clock/clock.service';
import { AssetErrorCode } from '../../../domain/errors/asset-error-code.enum';
import { SyncAssetsUseCase } from '../sync-assets.use-case';

describe('SyncAssetsUseCase', () => {
  const now = new Date('2026-07-28T08:00:00.000Z');
  const marketDataPort = {
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

  let useCase: SyncAssetsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    clockService.nowDate.mockReturnValue(now);

    useCase = new SyncAssetsUseCase(
      marketDataPort as any,
      assetRepository as any,
      clockService as unknown as ClockService,
      logger as any
    );
  });

  it('should fetch, normalize and persist asset market data', async () => {
    marketDataPort.fetchMarketData.mockResolvedValue([
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
        priceChangePercentage24h: '2.5'
      }
    ]);

    const result = await useCase.execute();

    expect(marketDataPort.fetchMarketData).toHaveBeenCalledTimes(1);
    expect(assetRepository.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        currentPrice: '120000',
        lastSyncedAt: now
      })
    ]);
    expect(result).toEqual({ receivedCount: 1, synchronizedCount: 1 });
  });

  it('should collapse duplicate provider identifiers, keeping the last record', async () => {
    marketDataPort.fetchMarketData.mockResolvedValue([
      {
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: null,
        currentPrice: '100',
        marketCap: null,
        marketCapRank: null,
        totalVolume: null,
        circulatingSupply: null,
        totalSupply: null,
        maxSupply: null,
        priceChange24h: null,
        priceChangePercentage24h: null
      },
      {
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: null,
        currentPrice: '120',
        marketCap: null,
        marketCapRank: null,
        totalVolume: null,
        circulatingSupply: null,
        totalSupply: null,
        maxSupply: null,
        priceChange24h: null,
        priceChangePercentage24h: null
      }
    ]);

    const result = await useCase.execute();

    expect(assetRepository.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({ coinGeckoId: 'bitcoin', currentPrice: '120' })
    ]);
    expect(result.synchronizedCount).toBe(1);
  });

  it('should throw when the provider returns no usable assets', async () => {
    marketDataPort.fetchMarketData.mockResolvedValue([]);

    const promise = useCase.execute();

    await expect(promise).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_SYNC_EMPTY_RESPONSE
    });
    expect(assetRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('should rethrow a classified provider error without persisting', async () => {
    const providerError = Object.assign(new Error('rate limited'), {
      code: AssetErrorCode.MARKET_DATA_PROVIDER_RATE_LIMITED
    });
    marketDataPort.fetchMarketData.mockRejectedValue(providerError);

    const promise = useCase.execute();

    await expect(promise).rejects.toBe(providerError);
    expect(assetRepository.upsertMany).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should be safe to run repeatedly', async () => {
    const fixtures = [
      {
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: null,
        currentPrice: '120000',
        marketCap: null,
        marketCapRank: null,
        totalVolume: null,
        circulatingSupply: null,
        totalSupply: null,
        maxSupply: null,
        priceChange24h: null,
        priceChangePercentage24h: null
      }
    ];
    marketDataPort.fetchMarketData.mockResolvedValue(fixtures);

    await useCase.execute();
    await useCase.execute();

    expect(assetRepository.upsertMany).toHaveBeenCalledTimes(2);
    expect(assetRepository.upsertMany.mock.calls[0][0]).toEqual(
      assetRepository.upsertMany.mock.calls[1][0]
    );
  });
});
