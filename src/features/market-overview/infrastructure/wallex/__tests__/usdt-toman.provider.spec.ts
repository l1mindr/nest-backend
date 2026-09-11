import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { WallexUsdtTomanProvider } from '../usdt-toman.provider';
import { MarketOverviewErrorCode } from '../../../domain/errors/market-overview-error-code.enum';

const BASE_URL = 'https://api.wallex.test';

/** Builds the axios failure shape for an upstream HTTP status. */
function httpError(status: number): AxiosError {
  return new AxiosError('upstream', undefined, undefined, undefined, {
    status
  } as never);
}

/** Builds the axios failure shape axios raises when a request times out. */
function timeoutError(code = 'ECONNABORTED'): AxiosError {
  return new AxiosError('timeout of 10000ms exceeded', code);
}

/** Wraps market stats in Wallex's `/v1/markets` envelope. */
function marketsBody(stats: Record<string, unknown>) {
  return {
    result: { symbols: { USDTTMN: { symbol: 'USDTTMN', stats } } },
    success: true
  };
}

describe('WallexUsdtTomanProvider', () => {
  const httpService = { get: jest.fn() };
  const logger = { setContext: jest.fn(), warn: jest.fn() };

  const baseConfig = {
    baseUrl: BASE_URL,
    timeoutMs: 10_000,
    retries: 0,
    backoffMs: 1
  };

  let config: typeof baseConfig;
  let provider: WallexUsdtTomanProvider;

  // Real field shapes from `GET /v1/markets`: the price is a string padded to
  // 16 decimals and already in Toman; the change is a JSON number.
  const validBody = marketsBody({
    lastPrice: '234251.0000000000000000',
    '24h_ch': 2.88
  });

  beforeEach(() => {
    jest.resetAllMocks();
    config = { ...baseConfig };
    provider = new WallexUsdtTomanProvider(
      httpService as unknown as HttpService,
      config as never,
      logger as never
    );
  });

  describe('success', () => {
    it('serves the Toman market unscaled, trimming the padded zeros', async () => {
      httpService.get.mockReturnValueOnce(of({ data: validBody }));

      const result = await provider.fetchUsdtTomanRate();

      expect(result).toMatchObject({
        priceToman: '234251',
        priceChangePercentage24h: '2.8800',
        provider: 'wallex'
      });
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(httpService.get).toHaveBeenCalledWith(`${BASE_URL}/v1/markets`, {
        timeout: 10_000
      });
    });

    it('accepts a numeric price as well as a string one', async () => {
      httpService.get.mockReturnValueOnce(
        of({ data: marketsBody({ lastPrice: 234_251 }) })
      );

      await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
        priceToman: '234251'
      });
    });

    it('carries the 24h change through, defaulting to zero when absent', async () => {
      httpService.get.mockReturnValueOnce(
        of({ data: marketsBody({ lastPrice: '234251', '24h_ch': -1.42 }) })
      );

      await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
        priceChangePercentage24h: '-1.4200'
      });

      httpService.get.mockReturnValueOnce(
        of({ data: marketsBody({ lastPrice: '234251' }) })
      );

      await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
        priceChangePercentage24h: '0.0000'
      });
    });

    // Wallex quotes Toman, Nobitex quotes Rial. Both adapters must land on the
    // same economic quantity, which is the whole point of the abstraction.
    it('agrees with the Rial venue on the same economic quantity', async () => {
      httpService.get.mockReturnValueOnce(
        of({ data: marketsBody({ lastPrice: '234619' }) })
      );

      // Nobitex would report 2346190 Rial for this; ÷10 is the same number.
      await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
        priceToman: '234619'
      });
    });

    it('holds a high-precision price without floating-point corruption', async () => {
      httpService.get.mockReturnValueOnce(
        of({ data: marketsBody({ lastPrice: '234619.1234567890123456' }) })
      );

      await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
        priceToman: '234619.1234567890123456'
      });
    });
  });

  describe('malformed responses', () => {
    it.each([
      ['a payload that is not an object', 'nope'],
      ['a null payload', null],
      ['a payload with no result', { success: true }],
      ['a payload with no symbols', { result: {} }],
      ['a payload missing the usdt market', { result: { symbols: {} } }],
      [
        'a market missing its stats',
        { result: { symbols: { USDTTMN: { symbol: 'USDTTMN' } } } }
      ],
      ['a non-numeric price', marketsBody({ lastPrice: 'abc' })],
      ['a missing price', marketsBody({ '24h_ch': 1 })],
      ['a zero price', marketsBody({ lastPrice: 0 })],
      [
        'a zero price as a padded string',
        marketsBody({ lastPrice: '0.0000000000000000' })
      ],
      ['a negative price', marketsBody({ lastPrice: -234_251 })],
      ['a negative price as a string', marketsBody({ lastPrice: '-234251' })]
    ])('rejects %s as an invalid response', async (_label, body) => {
      httpService.get.mockReturnValue(of({ data: body }));

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_INVALID_RESPONSE
        })
      );
    });

    it('does not retry a malformed body', async () => {
      config.retries = 3;
      httpService.get.mockReturnValue(of({ data: { result: {} } }));

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow();
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('transport failures', () => {
    it('maps a timeout onto the timeout error', async () => {
      httpService.get.mockReturnValue(throwError(() => timeoutError()));

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_TIMEOUT
        })
      );
    });

    it('maps ETIMEDOUT onto the timeout error too', async () => {
      httpService.get.mockReturnValue(
        throwError(() => timeoutError('ETIMEDOUT'))
      );

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_TIMEOUT
        })
      );
    });

    it('maps a rate limit onto the rate-limited error', async () => {
      httpService.get.mockReturnValue(throwError(() => httpError(429)));

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_RATE_LIMITED
        })
      );
    });

    it('maps a 5xx onto the unavailable error', async () => {
      httpService.get.mockReturnValue(throwError(() => httpError(502)));

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_UNAVAILABLE
        })
      );
    });

    it('maps an unresolvable host onto the unavailable error', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new AxiosError('getaddrinfo ENOTFOUND', 'ENOTFOUND'))
      );

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_UNAVAILABLE
        })
      );
    });

    it('retries a 5xx and succeeds on a later attempt', async () => {
      config.retries = 1;
      httpService.get
        .mockReturnValueOnce(throwError(() => httpError(503)))
        .mockReturnValueOnce(of({ data: validBody }));

      await expect(provider.fetchUsdtTomanRate()).resolves.toMatchObject({
        priceToman: '234251'
      });
      expect(httpService.get).toHaveBeenCalledTimes(2);
    });

    it('retries a rate limit and gives up with the rate-limited error', async () => {
      config.retries = 2;
      httpService.get.mockReturnValue(throwError(() => httpError(429)));

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_RATE_LIMITED
        })
      );
      expect(httpService.get).toHaveBeenCalledTimes(3);
    });

    it('does not retry a permanent 4xx rejection', async () => {
      config.retries = 3;
      httpService.get.mockReturnValue(throwError(() => httpError(404)));

      await expect(provider.fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_BAD_REQUEST
        })
      );
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });
  });
});
