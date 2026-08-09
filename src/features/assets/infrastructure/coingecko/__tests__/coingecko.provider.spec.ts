import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { UnrecoverableError } from 'bullmq';
import { AppError } from '@core/errors/app.error';
import { AssetErrorCode } from '../../../domain/errors/asset-error-code.enum';
import { CoinGeckoMarketDataProvider } from '../coingecko.provider';

const BASE_URL = 'https://api.coingecko.com/api/v3';

describe('CoinGeckoMarketDataProvider', () => {
  const httpService = {
    get: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  };

  const baseConfig = {
    baseUrl: BASE_URL,
    apiKey: null as string | null,
    pageSize: 2,
    maxPages: 5,
    timeoutMs: 10_000,
    retries: 2,
    backoffMs: 1
  };

  let config: typeof baseConfig;
  let provider: CoinGeckoMarketDataProvider;

  beforeEach(() => {
    jest.resetAllMocks();
    config = { ...baseConfig, apiKey: null };
    provider = new CoinGeckoMarketDataProvider(
      httpService as unknown as HttpService,
      config as any,
      logger as any
    );
  });

  it('should fetch paginated market data and normalize it', async () => {
    const page1 = [
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        image: 'https://example.test/bitcoin.png',
        current_price: 96_785.25,
        market_cap: 1_912_345_678_901.23,
        market_cap_rank: 1,
        total_volume: 48_210_987_654.32,
        circulating_supply: 19_758_964,
        total_supply: 21_000_000,
        max_supply: 21_000_000,
        price_change_24h: 1_524.1,
        price_change_percentage_24h: 1.6032
      },
      {
        id: 'ethereum',
        symbol: 'ETH',
        name: 'Ethereum',
        current_price: 3_456.78
      }
    ];
    const page2 = [{ id: 'solana', symbol: 'SOL', name: 'Solana' }];

    httpService.get
      .mockReturnValueOnce(of({ data: page1 }))
      .mockReturnValueOnce(of({ data: page2 }));

    const result = await provider.fetchMarketData();

    expect(result).toEqual([
      {
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://example.test/bitcoin.png',
        currentPrice: '96785.25',
        marketCap: '1912345678901.23',
        marketCapRank: 1,
        totalVolume: '48210987654.32',
        circulatingSupply: '19758964',
        totalSupply: '21000000',
        maxSupply: '21000000',
        priceChange24h: '1524.1',
        priceChangePercentage24h: '1.6032'
      },
      {
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        imageUrl: null,
        currentPrice: '3456.78',
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
        coinGeckoId: 'solana',
        symbol: 'sol',
        name: 'Solana',
        imageUrl: null,
        currentPrice: null,
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
    expect(httpService.get).toHaveBeenCalledTimes(2);
    expect(httpService.get).toHaveBeenCalledWith(`${BASE_URL}/coins/markets`, {
      headers: undefined,
      timeout: 10_000,
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 2,
        page: 1
      }
    });
    expect(httpService.get).toHaveBeenLastCalledWith(
      `${BASE_URL}/coins/markets`,
      {
        headers: undefined,
        timeout: 10_000,
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 2,
          page: 2
        }
      }
    );
  });

  it('should attach the API key header when configured', async () => {
    config.apiKey = 'test-api-key';
    httpService.get.mockReturnValueOnce(of({ data: [] }));

    await provider.fetchMarketData();

    expect(httpService.get).toHaveBeenCalledWith(
      `${BASE_URL}/coins/markets`,
      expect.objectContaining({
        headers: { 'x-cg-demo-api-key': 'test-api-key' }
      })
    );
  });

  it('should skip records missing required identity fields', async () => {
    httpService.get
      .mockReturnValueOnce(
        of({
          data: [
            { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
            { id: '', symbol: 'bad', name: 'Missing id' },
            { symbol: 'noid', name: 'No id at all' },
            null,
            'garbage',
            { id: 'nodata' }
          ]
        })
      )
      .mockReturnValueOnce(of({ data: [] }));

    const result = await provider.fetchMarketData();

    expect(result).toHaveLength(1);
    expect(result[0].coinGeckoId).toBe('bitcoin');
  });

  it('should map non-finite numeric values to null instead of crashing', async () => {
    httpService.get.mockReturnValueOnce(
      of({
        data: [
          {
            id: 'weird',
            symbol: 'weird',
            name: 'Weird',
            current_price: Number.NaN,
            market_cap: Number.POSITIVE_INFINITY,
            market_cap_rank: 1.5
          }
        ]
      })
    );

    const result = await provider.fetchMarketData();

    expect(result[0].currentPrice).toBeNull();
    expect(result[0].marketCap).toBeNull();
    expect(result[0].marketCapRank).toBe(1);
  });

  it('should stop paging when a page is shorter than the page size', async () => {
    httpService.get
      .mockReturnValueOnce(of({ data: [{ id: 'a', symbol: 'a', name: 'A' }] }))
      .mockReturnValueOnce(of({ data: [] }));

    const result = await provider.fetchMarketData();

    expect(result).toHaveLength(1);
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should respect the max page ceiling', async () => {
    const fullPage = Array.from({ length: 2 }, (_, index) => ({
      id: `coin-${index}`,
      symbol: `c${index}`,
      name: `Coin ${index}`
    }));
    config.maxPages = 2;
    httpService.get.mockReturnValue(of({ data: fullPage }));

    const result = await provider.fetchMarketData();

    expect(result).toHaveLength(4);
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('should retry a 429 and succeed on the next attempt', async () => {
    httpService.get
      .mockReturnValueOnce(
        throwError(() => ({ response: { status: 429 }, isAxiosError: true }))
      )
      .mockReturnValueOnce(
        of({ data: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }] })
      );

    const result = await provider.fetchMarketData();

    expect(result).toHaveLength(1);
    expect(httpService.get).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should throw a classified rate-limited error after retries are exhausted', async () => {
    config.retries = 1;
    httpService.get.mockReturnValue(
      throwError(() => ({ response: { status: 429 }, isAxiosError: true }))
    );

    const promise = provider.fetchMarketData();

    await expect(promise).rejects.toMatchObject({
      code: AssetErrorCode.MARKET_DATA_PROVIDER_RATE_LIMITED
    });
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('should retry 5xx failures', async () => {
    httpService.get
      .mockReturnValueOnce(
        throwError(() => ({ response: { status: 503 }, isAxiosError: true }))
      )
      .mockReturnValueOnce(
        of({ data: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }] })
      );

    const result = await provider.fetchMarketData();

    expect(result).toHaveLength(1);
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('should classify a timeout as a provider timeout', async () => {
    httpService.get.mockReturnValue(
      throwError(() => ({ code: 'ECONNABORTED', isAxiosError: true }))
    );

    const promise = provider.fetchMarketData();

    await expect(promise).rejects.toMatchObject({
      code: AssetErrorCode.MARKET_DATA_PROVIDER_TIMEOUT
    });
  });

  it('should classify a network error as provider unavailable', async () => {
    httpService.get.mockReturnValue(
      throwError(() => ({ code: 'ECONNREFUSED', isAxiosError: true }))
    );

    const promise = provider.fetchMarketData();

    await expect(promise).rejects.toMatchObject({
      code: AssetErrorCode.MARKET_DATA_PROVIDER_UNAVAILABLE
    });
  });

  it('should not retry permanent 4xx rejections', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(
      throwError(() => ({ response: { status: 403 }, isAxiosError: true }))
    );

    const promise = provider.fetchMarketData();

    await expect(promise).rejects.toBeInstanceOf(UnrecoverableError);
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should reject a non-array response body as invalid without retrying', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(of({ data: { status: 'error' } }));

    const promise = provider.fetchMarketData();

    await expect(promise).rejects.toBeInstanceOf(UnrecoverableError);
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should throw an AppError when a non-axios transport error surfaces', async () => {
    config.retries = 0;
    httpService.get.mockReturnValue(throwError(() => new Error('boom')));

    const promise = provider.fetchMarketData();

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      code: AssetErrorCode.MARKET_DATA_PROVIDER_UNAVAILABLE
    });
  });
});
