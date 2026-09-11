import { UsdtTomanEntry } from '../../../application/interfaces/usdt-toman.interface';
import { MarketOverviewErrorCode } from '../../../domain/errors/market-overview-error-code.enum';
import { MarketOverviewErrors } from '../../../domain/errors/market-overview-errors';
import { NobitexUsdtTomanProvider } from '../../nobitex/usdt-toman.provider';
import { WallexUsdtTomanProvider } from '../../wallex/usdt-toman.provider';
import { FailoverUsdtTomanProvider } from '../failover-usdt-toman.provider';
import { UsdtTomanProviderName } from '../usdt-toman.config';

function entry(provider: string, priceToman: string): UsdtTomanEntry {
  return {
    priceToman,
    priceChangePercentage24h: '1.0000',
    updatedAt: new Date('2026-09-09T12:00:00.000Z'),
    provider
  };
}

const NOBITEX_RATE = entry('nobitex', '234619');
const WALLEX_RATE = entry('wallex', '234251');

describe('FailoverUsdtTomanProvider', () => {
  const logger = {
    setContext: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const nobitex = { name: 'nobitex', fetchUsdtTomanRate: jest.fn() };
  const wallex = { name: 'wallex', fetchUsdtTomanRate: jest.fn() };

  function build(provider: UsdtTomanProviderName) {
    return new FailoverUsdtTomanProvider(
      nobitex as unknown as NobitexUsdtTomanProvider,
      wallex as unknown as WallexUsdtTomanProvider,
      { provider, cacheTtlMs: 60_000 },
      logger as never
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('provider selection', () => {
    it('calls nobitex first when it is the configured provider', async () => {
      nobitex.fetchUsdtTomanRate.mockResolvedValue(NOBITEX_RATE);

      await expect(build('nobitex').fetchUsdtTomanRate()).resolves.toBe(
        NOBITEX_RATE
      );
      expect(nobitex.fetchUsdtTomanRate).toHaveBeenCalledTimes(1);
      expect(wallex.fetchUsdtTomanRate).not.toHaveBeenCalled();
    });

    it('calls wallex first when it is the configured provider', async () => {
      wallex.fetchUsdtTomanRate.mockResolvedValue(WALLEX_RATE);

      await expect(build('wallex').fetchUsdtTomanRate()).resolves.toBe(
        WALLEX_RATE
      );
      expect(wallex.fetchUsdtTomanRate).toHaveBeenCalledTimes(1);
      expect(nobitex.fetchUsdtTomanRate).not.toHaveBeenCalled();
    });

    it('falls back to the declared order when the configured name is unknown', async () => {
      nobitex.fetchUsdtTomanRate.mockResolvedValue(NOBITEX_RATE);

      // Startup validation rejects this, so reaching it means the config list
      // and the registered providers have drifted apart.
      const provider = build('binance' as UsdtTomanProviderName);

      await expect(provider.fetchUsdtTomanRate()).resolves.toBe(NOBITEX_RATE);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ configured: 'binance' }),
        expect.stringContaining('not registered')
      );
    });
  });

  describe('fallback', () => {
    it('does not call the fallback when the preferred provider succeeds', async () => {
      nobitex.fetchUsdtTomanRate.mockResolvedValue(NOBITEX_RATE);

      await build('nobitex').fetchUsdtTomanRate();

      expect(wallex.fetchUsdtTomanRate).not.toHaveBeenCalled();
    });

    it('calls wallex and returns its price when nobitex fails', async () => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerUnavailable()
      );
      wallex.fetchUsdtTomanRate.mockResolvedValue(WALLEX_RATE);

      const result = await build('nobitex').fetchUsdtTomanRate();

      expect(result).toBe(WALLEX_RATE);
      expect(result.provider).toBe('wallex');
      expect(nobitex.fetchUsdtTomanRate).toHaveBeenCalledTimes(1);
      expect(wallex.fetchUsdtTomanRate).toHaveBeenCalledTimes(1);
    });

    // The reverse direction: whichever venue is preferred, the other backs it.
    it('calls nobitex and returns its price when wallex fails', async () => {
      wallex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerTimeout()
      );
      nobitex.fetchUsdtTomanRate.mockResolvedValue(NOBITEX_RATE);

      const result = await build('wallex').fetchUsdtTomanRate();

      expect(result).toBe(NOBITEX_RATE);
      expect(result.provider).toBe('nobitex');
      expect(wallex.fetchUsdtTomanRate).toHaveBeenCalledTimes(1);
      expect(nobitex.fetchUsdtTomanRate).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a timeout', MarketOverviewErrors.providerTimeout()],
      ['a connection failure', MarketOverviewErrors.providerUnavailable()],
      ['a rate limit', MarketOverviewErrors.providerRateLimited()],
      ['a rejected request', MarketOverviewErrors.providerBadRequest()],
      ['a malformed response', MarketOverviewErrors.providerInvalidResponse()],
      ['an unexpected error', new Error('boom')]
    ])('falls back after %s', async (_label, error) => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(error);
      wallex.fetchUsdtTomanRate.mockResolvedValue(WALLEX_RATE);

      await expect(build('nobitex').fetchUsdtTomanRate()).resolves.toBe(
        WALLEX_RATE
      );
    });

    it('fails with a clear error when every provider fails', async () => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerUnavailable()
      );
      wallex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerTimeout()
      );

      await expect(build('nobitex').fetchUsdtTomanRate()).rejects.toThrow(
        expect.objectContaining({
          code: MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDERS_EXHAUSTED,
          message: 'All market data providers failed (nobitex, wallex)'
        })
      );
      expect(nobitex.fetchUsdtTomanRate).toHaveBeenCalledTimes(1);
      expect(wallex.fetchUsdtTomanRate).toHaveBeenCalledTimes(1);
    });

    // A stale price is the use case's decision to make, not this one's.
    it('never invents a price of its own when everything fails', async () => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(new Error('down'));
      wallex.fetchUsdtTomanRate.mockRejectedValue(new Error('down'));

      await expect(build('nobitex').fetchUsdtTomanRate()).rejects.toThrow();
    });
  });

  describe('observability', () => {
    it('logs the failure and the venue it is falling back to', async () => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerRateLimited()
      );
      wallex.fetchUsdtTomanRate.mockResolvedValue(WALLEX_RATE);

      await build('nobitex').fetchUsdtTomanRate();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'nobitex',
          category: 'rate_limited',
          status: 429,
          durationMs: expect.any(Number)
        }),
        'USDT price provider "nobitex" failed; falling back to "wallex"'
      );
    });

    it('records a successful fallback without treating it as a failure', async () => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerUnavailable()
      );
      wallex.fetchUsdtTomanRate.mockResolvedValue(WALLEX_RATE);

      await build('nobitex').fetchUsdtTomanRate();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'wallex', failedOver: true }),
        'USDT price provider "nobitex" failed; falling back to "wallex"'
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('categorises an unrecognised failure rather than guessing', async () => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(new Error('boom'));
      wallex.fetchUsdtTomanRate.mockResolvedValue(WALLEX_RATE);

      await build('nobitex').fetchUsdtTomanRate();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'unknown', status: undefined }),
        expect.any(String)
      );
    });

    it('logs every failure at error level once the chain is exhausted', async () => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerTimeout()
      );
      wallex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerInvalidResponse()
      );

      await expect(build('nobitex').fetchUsdtTomanRate()).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: ['nobitex', 'wallex'],
          failures: [
            expect.objectContaining({
              provider: 'nobitex',
              category: 'timeout'
            }),
            expect.objectContaining({
              provider: 'wallex',
              category: 'invalid_response'
            })
          ]
        }),
        'All USDT price providers failed'
      );
    });

    it('keeps request details out of the structured log fields', async () => {
      nobitex.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providerUnavailable()
      );
      wallex.fetchUsdtTomanRate.mockResolvedValue(WALLEX_RATE);

      await build('nobitex').fetchUsdtTomanRate();

      const [fields] = logger.warn.mock.calls[0];

      // Only the venue name, category, status and timing — nothing that could
      // carry a host, query string, header or credential.
      expect(Object.keys(fields).sort()).toEqual([
        'category',
        'durationMs',
        'err',
        'nextProvider',
        'provider',
        'status'
      ]);
    });
  });
});
