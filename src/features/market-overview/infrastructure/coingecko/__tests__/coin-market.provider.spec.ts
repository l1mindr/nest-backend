import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AppError } from '@core/errors/app.error';
import { MarketOverviewErrorCode } from '../../../domain/errors/market-overview-error-code.enum';
import { CoinGeckoCoinMarketProvider } from '../coin-market.provider';

const BASE_URL = 'https://api.coingecko.com/api/v3';

describe('CoinGeckoCoinMarketProvider', () => {
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
    cacheTtlMs: 90_000,
    bitcoinCacheTtlMs: 30_000
  };

  let config: typeof baseConfig;
  let provider: CoinGeckoCoinMarketProvider;

  const validBody = {
    bitcoin: {
      usd: 112345.67,
      usd_24h_change: 1.2345,
      last_updated_at: 1_753_700_000
    }
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config = { ...baseConfig, apiKey: null };
    provider = new CoinGeckoCoinMarketProvider(
      httpService as unknown as HttpService,
      config as any,
      logger as any
    );
  });

  it('should fetch and normalize the bitcoin ticker', async () => {
    httpService.get.mockReturnValueOnce(of({ data: validBody }));

    const result = await provider.fetchCoinMarketData('bitcoin');

    expect(result).toEqual({
      priceUsd: '112345.67',
      priceChangePercentage24h: '1.2345',
      updatedAt: new Date(1_753_700_000 * 1000)
    });
    expect(httpService.get).toHaveBeenCalledWith(`${BASE_URL}/simple/price`, {
      headers: undefined,
      timeout: 10_000,
      params: {
        ids: 'bitcoin',
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_last_updated_at: true
      }
    });
  });

  it('should attach the API key header when configured', async () => {
    config.apiKey = 'test-api-key';
    httpService.get.mockReturnValueOnce(of({ data: validBody }));

    await provider.fetchCoinMarketData('bitcoin');

    expect(httpService.get).toHaveBeenCalledWith(
      `${BASE_URL}/simple/price`,
      expect.objectContaining({
        headers: { 'x-cg-demo-api-key': 'test-api-key' }
      })
    );
  });

  it('should default a missing 24h change percentage to zero', async () => {
    httpService.get.mockReturnValueOnce(
      of({
        data: {
          bitcoin: { usd: 100, last_updated_at: 1_753_700_000 }
        }
      })
    );

    const result = await provider.fetchCoinMarketData('bitcoin');

    expect(result.priceChangePercentage24h).toBe('0');
  });

  it('should reject a response missing required fields as invalid, without retrying', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(
      of({ data: { bitcoin: { usd_24h_change: 1.2 } } })
    );

    const promise = provider.fetchCoinMarketData('bitcoin');

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_INVALID_RESPONSE
    });
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should reject a non-object body as invalid, without retrying', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(of({ data: 'garbage' }));

    const promise = provider.fetchCoinMarketData('bitcoin');

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

    const result = await provider.fetchCoinMarketData('bitcoin');

    expect(result.priceUsd).toBe('112345.67');
    expect(httpService.get).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should throw a classified rate-limited error after retries are exhausted', async () => {
    config.retries = 1;
    httpService.get.mockReturnValue(
      throwError(() => ({ response: { status: 429 }, isAxiosError: true }))
    );

    const promise = provider.fetchCoinMarketData('bitcoin');

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_RATE_LIMITED
    });
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('should not retry permanent 4xx rejections', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(
      throwError(() => ({ response: { status: 403 }, isAxiosError: true }))
    );

    const promise = provider.fetchCoinMarketData('bitcoin');

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_BAD_REQUEST
    });
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should classify a timeout as a provider timeout', async () => {
    httpService.get.mockReturnValue(
      throwError(() => ({ code: 'ECONNABORTED', isAxiosError: true }))
    );

    const promise = provider.fetchCoinMarketData('bitcoin');

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_TIMEOUT
    });
  });

  it('should classify a network error as provider unavailable', async () => {
    config.retries = 0;
    httpService.get.mockReturnValue(
      throwError(() => ({ code: 'ECONNREFUSED', isAxiosError: true }))
    );

    const promise = provider.fetchCoinMarketData('bitcoin');

    await expect(promise).rejects.toMatchObject({
      code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_UNAVAILABLE
    });
  });
});
