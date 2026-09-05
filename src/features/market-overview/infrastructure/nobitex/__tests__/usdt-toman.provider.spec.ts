import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { NobitexUsdtTomanProvider } from '../usdt-toman.provider';
import { MarketOverviewErrorCode } from '../../../domain/errors/market-overview-error-code.enum';

const BASE_URL = 'https://api.nobitex.test';

describe('NobitexUsdtTomanProvider', () => {
  const httpService = { get: jest.fn() };
  const logger = { setContext: jest.fn(), warn: jest.fn() };

  const baseConfig = {
    baseUrl: BASE_URL,
    timeoutMs: 10_000,
    retries: 0,
    backoffMs: 1,
    cacheTtlMs: 60_000,
    rialPerToman: 10
  };

  let config: typeof baseConfig;
  let provider: NobitexUsdtTomanProvider;

  const validBody = {
    status: 'ok',
    stats: { 'usdt-rls': { latest: '1234500' } }
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config = { ...baseConfig };
    provider = new NobitexUsdtTomanProvider(
      httpService as unknown as HttpService,
      config as any,
      logger as any
    );
  });

  it('fetches the Rial market and serves it as Toman', async () => {
    httpService.get.mockReturnValueOnce(of({ data: validBody }));

    const result = await provider.fetchUsdtTomanRate();

    expect(result.priceToman).toBe('123450');
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(httpService.get).toHaveBeenCalledWith(`${BASE_URL}/market/stats`, {
      timeout: 10_000,
      params: { srcCurrency: 'usdt', dstCurrency: 'rls' }
    });
  });

  it('accepts a numeric rate as well as a string one', async () => {
    httpService.get.mockReturnValueOnce(
      of({ data: { stats: { 'usdt-rls': { latest: 987_650 } } } })
    );

    await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
      priceToman: '98765'
    });
  });

  // The unit guard: if the upstream is ever found to quote Toman already,
  // this divisor corrects it without a code change — so it has to apply.
  it('honours the configured Rial-per-Toman divisor', async () => {
    config.rialPerToman = 1;
    httpService.get.mockReturnValueOnce(
      of({ data: { stats: { 'usdt-rls': { latest: 123_450 } } } })
    );

    await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
      priceToman: '123450'
    });
  });

  it('carries the 24h change through, defaulting to zero when absent', async () => {
    httpService.get.mockReturnValueOnce(
      of({
        data: {
          stats: { 'usdt-rls': { latest: 1_234_500, dayChange: '0.62' } }
        }
      })
    );

    await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
      priceToman: '123450',
      priceChangePercentage24h: '0.6200'
    });

    httpService.get.mockReturnValueOnce(of({ data: validBody }));

    await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
      priceChangePercentage24h: '0.0000'
    });
  });

  it.each([
    ['a payload that is not an object', 'nope'],
    ['a payload with no stats', { status: 'ok' }],
    [
      'a payload missing the usdt market',
      { stats: { 'btc-rls': { latest: 1 } } }
    ],
    ['a non-numeric rate', { stats: { 'usdt-rls': { latest: 'abc' } } }],
    ['a zero rate', { stats: { 'usdt-rls': { latest: 0 } } }],
    ['a negative rate', { stats: { 'usdt-rls': { latest: -5 } } }]
  ])('rejects %s as an invalid response', async (_label, body) => {
    httpService.get.mockReturnValue(of({ data: body }));

    await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
      expect.objectContaining({
        code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_INVALID_RESPONSE
      })
    );
  });

  it('retries a 5xx and succeeds on a later attempt', async () => {
    config.retries = 1;
    httpService.get
      .mockReturnValueOnce(
        throwError(
          () =>
            new AxiosError('boom', undefined, undefined, undefined, {
              status: 503
            } as never)
        )
      )
      .mockReturnValueOnce(of({ data: validBody }));

    await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
      priceToman: '123450'
    });
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permanent 4xx rejection', async () => {
    config.retries = 3;
    httpService.get.mockReturnValue(
      throwError(
        () =>
          new AxiosError('bad', undefined, undefined, undefined, {
            status: 400
          } as never)
      )
    );

    await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
      expect.objectContaining({
        code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_BAD_REQUEST
      })
    );
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });
});
