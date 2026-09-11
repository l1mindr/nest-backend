import { AppError } from '@core/errors/app.error';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  UsdtTomanEntry,
  UsdtTomanPort
} from '../../application/interfaces/usdt-toman.interface';
import { MarketOverviewErrorCode } from '../../domain/errors/market-overview-error-code.enum';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';
import { NobitexUsdtTomanProvider } from '../nobitex/usdt-toman.provider';
import { WallexUsdtTomanProvider } from '../wallex/usdt-toman.provider';
import usdtTomanConfig, { USDT_TOMAN_PROVIDERS } from './usdt-toman.config';

/**
 * Coarse bucket for a provider failure, for logs and metrics. Derived from the
 * `AppError` the adapters already raise, so a new failure mode shows up here
 * as `unknown` rather than being silently folded into an existing bucket.
 */
type FailureCategory =
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'bad_request'
  | 'invalid_response'
  | 'unknown';

const FAILURE_CATEGORIES: Record<string, FailureCategory> = {
  [MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_RATE_LIMITED]:
    'rate_limited',
  [MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_TIMEOUT]: 'timeout',
  [MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_UNAVAILABLE]: 'unavailable',
  [MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_BAD_REQUEST]: 'bad_request',
  [MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_INVALID_RESPONSE]:
    'invalid_response'
};

interface ProviderFailure {
  provider: string;
  category: FailureCategory;
  status: number | undefined;
  durationMs: number;
}

/**
 * Fans the USDT/Toman rate out across the configured exchanges: the preferred
 * one first, then the rest in the fixed order of {@link USDT_TOMAN_PROVIDERS}.
 *
 * It implements `UsdtTomanPort` itself, so the use case and the cache above it
 * are unchanged and know nothing about there being more than one venue — the
 * whole chain looks like a single provider from the outside.
 *
 * What it deliberately does not do is serve an old value: a failure here is a
 * failure, and the decision to fall back to a cached rate stays with the use
 * case, which marks such a response `isStale`. Every attempt is logged with
 * its venue, failure category and duration; hosts, query strings and headers
 * are not, so nothing that could carry a credential reaches the log.
 */
@Injectable()
export class FailoverUsdtTomanProvider implements UsdtTomanPort {
  /**
   * Not a venue — the chain reports the venue that actually answered on each
   * entry's `provider` field instead. Only used if something logs the port
   * itself.
   */
  readonly name = 'failover';

  private readonly providers: readonly UsdtTomanPort[];

  constructor(
    nobitex: NobitexUsdtTomanProvider,
    wallex: WallexUsdtTomanProvider,
    @Inject(usdtTomanConfig.KEY)
    private readonly config: ConfigType<typeof usdtTomanConfig>,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(FailoverUsdtTomanProvider.name);
    this.providers = this.order([nobitex, wallex]);
  }

  /**
   * Returns the first rate a venue will give up, trying each in order.
   *
   * A successful fallback resolves normally — the rate is just as valid for
   * having come from the second venue — but is logged at `warn` so it stays
   * visible rather than passing as an ordinary success.
   */
  async fetchUsdtTomanRate(): Promise<UsdtTomanEntry> {
    const failures: ProviderFailure[] = [];

    for (const [index, provider] of this.providers.entries()) {
      const startedAt = Date.now();

      try {
        const entry = await provider.fetchUsdtTomanRate();

        if (failures.length > 0) {
          this.logger.warn(
            {
              provider: provider.name,
              failedOver: true,
              failures,
              durationMs: Date.now() - startedAt
            },
            `USDT price provider "${failures[failures.length - 1].provider}" failed; falling back to "${provider.name}"`
          );
        }

        return entry;
      } catch (error) {
        const failure = this.describe(provider.name, error, startedAt);
        failures.push(failure);

        const next = this.providers[index + 1];

        this.logger.warn(
          { ...failure, err: error, nextProvider: next?.name },
          next
            ? `USDT price provider "${provider.name}" failed; falling back to "${next.name}"`
            : `USDT price provider "${provider.name}" failed and no fallback remains`
        );
      }
    }

    // Reached only when every venue has failed. Logged at `error` with the
    // whole chain, because at this point the endpoint is down rather than
    // degraded and the per-provider warnings alone would not say so.
    this.logger.error(
      { failures, providers: this.providers.map((provider) => provider.name) },
      'All USDT price providers failed'
    );

    throw MarketOverviewErrors.providersExhausted(
      this.providers.map((provider) => provider.name)
    );
  }

  /**
   * Puts the configured preference first and keeps the remaining venues in
   * their declared order, so the fallback sequence is fully determined by
   * configuration rather than by DI resolution order.
   *
   * An unknown preference cannot reach this — `USDT_TOMAN_PROVIDER` is
   * validated against the same list at startup — so an unmatched name here
   * would mean the two lists have drifted, and the declared order is used
   * unchanged rather than guessing.
   */
  private order(providers: readonly UsdtTomanPort[]): readonly UsdtTomanPort[] {
    const declared = USDT_TOMAN_PROVIDERS.map((name) =>
      providers.find((provider) => provider.name === name)
    ).filter((provider): provider is UsdtTomanPort => provider !== undefined);

    const preferred = declared.find(
      (provider) => provider.name === this.config.provider
    );

    if (!preferred) {
      this.logger.warn(
        { configured: this.config.provider, known: USDT_TOMAN_PROVIDERS },
        'Configured USDT price provider is not registered; using the declared order'
      );

      return declared;
    }

    return [
      preferred,
      ...declared.filter((provider) => provider !== preferred)
    ];
  }

  /**
   * Reduces a failure to the fields worth keeping: which venue, what kind of
   * failure, the upstream status when there was one, and how long it took.
   * The error object itself is logged separately under `err`; nothing derived
   * from the request (URL, params, headers) is recorded.
   */
  private describe(
    provider: string,
    error: unknown,
    startedAt: number
  ): ProviderFailure {
    const code = error instanceof AppError ? error.code : undefined;

    return {
      provider,
      category: (code && FAILURE_CATEGORIES[code]) || 'unknown',
      status: error instanceof AppError ? error.statusCode : undefined,
      durationMs: Date.now() - startedAt
    };
  }
}
