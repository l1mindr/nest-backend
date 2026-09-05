import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AppError } from '@core/errors/app.error';
import { MarketSentimentErrorCode } from '../../../domain/errors/market-sentiment-error-code.enum';
import { AlternativeMeFearGreedProvider } from '../fear-greed.provider';

const BASE_URL = 'https://api.alternative.me/fng';

describe('AlternativeMeFearGreedProvider', () => {
  const httpService = {
    get: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    warn: jest.fn()
  };

  const baseConfig = {
    baseUrl: BASE_URL,
    timeoutMs: 10_000,
    retries: 2,
    backoffMs: 1,
    cacheTtlMs: 600_000
  };

  let config: typeof baseConfig;
  let provider: AlternativeMeFearGreedProvider;

  const validBody = {
    data: [
      {
        value: '74',
        value_classification: 'Greed',
        timestamp: '1753700000',
        time_until_update: '3600'
      }
    ]
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
    config = { ...baseConfig };
    provider = new AlternativeMeFearGreedProvider(
      httpService as unknown as HttpService,
      config as any,
      logger as any
    );
  });

  it('should fetch and normalize the fear & greed snapshot', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
    httpService.get.mockReturnValueOnce(of({ data: validBody }));

    const result = await provider.fetchFearGreedIndex();

    expect(result).toEqual({
      value: 74,
      classification: 'Greed',
      updatedAt: new Date(1_753_700_000 * 1000),
      nextUpdateAt: new Date(
        new Date('2026-08-02T00:00:00.000Z').getTime() + 3600 * 1000
      )
    });
    expect(httpService.get).toHaveBeenCalledWith(`${BASE_URL}/`, {
      timeout: 10_000,
      params: { limit: 1 }
    });
  });

  it('should default nextUpdateAt to null when time_until_update is absent', async () => {
    httpService.get.mockReturnValueOnce(
      of({
        data: {
          data: [
            {
              value: '20',
              value_classification: 'Extreme Fear',
              timestamp: '1753700000'
            }
          ]
        }
      })
    );

    const result = await provider.fetchFearGreedIndex();

    expect(result.nextUpdateAt).toBeNull();
  });

  it('should reject a response missing required fields as invalid, without retrying', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(
      of({ data: { data: [{ value_classification: 'Greed' }] } })
    );

    const promise = provider.fetchFearGreedIndex();

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      code: MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_INVALID_RESPONSE
    });
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should reject an empty data array as invalid, without retrying', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(of({ data: { data: [] } }));

    const promise = provider.fetchFearGreedIndex();

    await expect(promise).rejects.toMatchObject({
      code: MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_INVALID_RESPONSE
    });
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should retry a 429 and succeed on the next attempt', async () => {
    httpService.get
      .mockReturnValueOnce(
        throwError(() => ({ response: { status: 429 }, isAxiosError: true }))
      )
      .mockReturnValueOnce(of({ data: validBody }));

    const result = await provider.fetchFearGreedIndex();

    expect(result.value).toBe(74);
    expect(httpService.get).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should throw a classified rate-limited error after retries are exhausted', async () => {
    config.retries = 1;
    httpService.get.mockReturnValue(
      throwError(() => ({ response: { status: 429 }, isAxiosError: true }))
    );

    const promise = provider.fetchFearGreedIndex();

    await expect(promise).rejects.toMatchObject({
      code: MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_RATE_LIMITED
    });
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('should classify a timeout as a provider timeout', async () => {
    httpService.get.mockReturnValue(
      throwError(() => ({ code: 'ECONNABORTED', isAxiosError: true }))
    );

    const promise = provider.fetchFearGreedIndex();

    await expect(promise).rejects.toMatchObject({
      code: MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_TIMEOUT
    });
  });

  it('should not retry permanent 4xx rejections', async () => {
    config.retries = 5;
    httpService.get.mockReturnValue(
      throwError(() => ({ response: { status: 403 }, isAxiosError: true }))
    );

    const promise = provider.fetchFearGreedIndex();

    await expect(promise).rejects.toMatchObject({
      code: MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_BAD_REQUEST
    });
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('should classify a network error as provider unavailable', async () => {
    config.retries = 0;
    httpService.get.mockReturnValue(
      throwError(() => ({ code: 'ECONNREFUSED', isAxiosError: true }))
    );

    const promise = provider.fetchFearGreedIndex();

    await expect(promise).rejects.toMatchObject({
      code: MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_UNAVAILABLE
    });
  });
});
