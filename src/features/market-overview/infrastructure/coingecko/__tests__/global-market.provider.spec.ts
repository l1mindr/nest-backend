import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AppError } from '@core/errors/app.error';
import { MarketOverviewErrorCode } from '../../../domain/errors/market-overview-error-code.enum';
import { CoinGeckoGlobalMarketProvider } from '../global-market.provider';

const BASE_URL = 'https://api.coingecko.com/api/v3';

describe('CoinGeckoGlobalMarketProvider', () => {
  const httpService = {
    get: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    warn: jest.fn()
  };

  const baseConfig = {
    baseUrl: BASE_URL,
    apiKey: null as string | null,
    timeoutMs: 10_000,
    retries: 2,
    backoffMs: 1,
    cacheTtlMs: 90_000
  };

  let config: typeof baseConfig;
  let provider: CoinGeckoGlobalMarketProvider;

  const validBody = {
    data: {
      total_market_cap: { usd: 2_412_345_678_901.23 },
      market_cap_change_percentage_24h_usd: 1.2345,
      market_cap_percentage: { btc: 51.3201, eth: 17.8432 },
      updated_at: 1_753_700_000
    }
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config = { ...baseConfig, apiKey: null };
    provider = new CoinGeckoGlobalMarketProvider(
      httpService as unknown as HttpService,
      config as any,
      logger as any
    );
  });

  it('should fetch and normalize the global market snapshot', async () => {
    httpService.get.mockReturnValueOnce(of({ data: validBody }));

    const result = await provider.fetchGlobalMarketData();

    expect(result).toEqual({
      totalMarketCapUsd: '2412345678901.23',
      marketCapChangePercentage24h: '1.2345',
      btcDominancePercentage: '51.3201',
      ethDominancePercentage: '17.8432',
      updatedAt: new Date(1_753_700_000 * 1000)
    });
    expect(httpService.get).toHaveBeenCalledWith(`${BASE_URL}/global`, {
      headers: undefined,
      timeout: 10_000
    });
  });

  it('should attach the API key header when configured', async () => {
    config.apiKey = 'test-api-key';
    httpService.get.mockReturnValueOnce(of({ data: validBody }));

    await provider.fetchGlobalMarketData();

    expect(httpService.get).toHaveBeenCalledWith(
      `${BASE_URL}/global`,
      expect.objectContaining({
        headers: { 'x-cg-demo-api-key': 'test-api-key' }
      })
    );
  });

  it('should default a missing 24h change percentage to zero', async () => {
    httpService.get.mockReturnValueOnce(
      of({
        data: {
          data: {
            total_market_cap: { usd: 100 },
            market_cap_percentage: { btc: 50, eth: 20 },
            updated_at: 1_753_700_000
          }
        }
      })
    );

    const result = await provider.fetchGlobalMarketData();

    expect(result.marketCapChangePercentage24h).toBe('0');
  });

  it('should reject a response missing required fields as invalid, without retrying', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(
      of({ data: { total_market_cap: { usd: 100 } } })
    );

    const promise = provider.fetchGlobalMarketData();

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_INVALID_RESPONSE
    });
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should reject a non-object body as invalid, without retrying', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(of({ data: 'garbage' }));

    const promise = provider.fetchGlobalMarketData();

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_INVALID_RESPONSE
    });
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should retry a 429 and succeed on the next attempt', async () => {
    httpService.get
      .mockReturnValueOnce(
        throwError(() => ({ response: { status: 429 }, isAxiosError: true }))
      )
      .mockReturnValueOnce(of({ data: validBody }));

    const result = await provider.fetchGlobalMarketData();

    expect(result.totalMarketCapUsd).toBe('2412345678901.23');
    expect(httpService.get).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should throw a classified rate-limited error after retries are exhausted', async () => {
    config.retries = 1;
    httpService.get.mockReturnValue(
      throwError(() => ({ response: { status: 429 }, isAxiosError: true }))
    );

    const promise = provider.fetchGlobalMarketData();

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_RATE_LIMITED
    });
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('should retry 5xx failures', async () => {
    httpService.get
      .mockReturnValueOnce(
        throwError(() => ({ response: { status: 503 }, isAxiosError: true }))
      )
      .mockReturnValueOnce(of({ data: validBody }));

    const result = await provider.fetchGlobalMarketData();

    expect(result.totalMarketCapUsd).toBe('2412345678901.23');
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('should classify a timeout as a provider timeout', async () => {
    httpService.get.mockReturnValue(
      throwError(() => ({ code: 'ECONNABORTED', isAxiosError: true }))
    );

    const promise = provider.fetchGlobalMarketData();

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_TIMEOUT
    });
  });

  it('should not retry permanent 4xx rejections', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(
      throwError(() => ({ response: { status: 403 }, isAxiosError: true }))
    );

    const promise = provider.fetchGlobalMarketData();

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_BAD_REQUEST
    });
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should classify a network error as provider unavailable', async () => {
    config.retries = 0;
    httpService.get.mockReturnValue(
      throwError(() => ({ code: 'ECONNREFUSED', isAxiosError: true }))
    );

    const promise = provider.fetchGlobalMarketData();

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_UNAVAILABLE
    });
  });
});
