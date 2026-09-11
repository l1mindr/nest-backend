import { AppError } from '@core/errors/app.error';
import { isAxiosError } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import {
  UsdtTomanEntry,
  UsdtTomanPort
} from '../../application/interfaces/usdt-toman.interface';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';

interface ClassifiedError {
  permanent: boolean;
  error: Error;
}

/**
 * Shared behaviour for the exchange adapters behind {@link UsdtTomanPort}.
 *
 * Retry policy, failure classification and backoff are identical for every
 * venue — only the request and the wire format differ — so they live here
 * rather than being copy-pasted per exchange. It mirrors the classification
 * the CoinGecko providers use, so all of the market upstreams behave the same
 * way under failure even though they talk to different venues.
 *
 * A subclass supplies the call ({@link request}) and the mapping onto the
 * application's vocabulary ({@link normalize}); everything else is fixed.
 */
export abstract class ExchangeUsdtTomanProvider implements UsdtTomanPort {
  abstract readonly name: string;

  protected abstract readonly logger: PinoLogger;

  /** Extra attempts after the first, read lazily so it tracks live config. */
  protected abstract get retries(): number;

  /** Base delay for the exponential backoff between attempts. */
  protected abstract get backoffMs(): number;

  /** Performs one call to the venue and returns its parsed body. */
  protected abstract request(): Promise<unknown>;

  /** Maps one venue's wire format onto {@link UsdtTomanEntry}. */
  protected abstract normalize(payload: unknown): UsdtTomanEntry;

  /**
   * Fetches the latest USDT/Toman rate. Transient failures (rate limit,
   * timeout, 5xx, network) are retried with exponential backoff; permanent
   * rejections (unexpected 4xx, malformed body) fail immediately — a retry
   * cannot fix either, and the failover chain above is waiting on the answer.
   */
  async fetchUsdtTomanRate(): Promise<UsdtTomanEntry> {
    const attempts = this.retries + 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const payload = await this.request();

        return this.normalize(payload);
      } catch (error) {
        const classified = this.classify(error);

        if (classified.permanent) throw classified.error;

        lastError = classified.error;

        if (attempt < attempts) {
          const delayMs = this.backoffMs * 2 ** (attempt - 1);
          this.logger.warn(
            {
              provider: this.name,
              attempt,
              nextAttempt: attempt + 1,
              backoffMs: delayMs,
              err: classified.error
            },
            'USDT rate request failed and will be retried'
          );
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError ?? MarketOverviewErrors.providerUnavailable();
  }

  /**
   * Sorts an upstream failure into retryable (transient) and non-retryable
   * (permanent) buckets. A non-axios failure is treated as transient.
   *
   * Note what this deliberately does *not* distinguish: a DNS failure has no
   * response and no timeout code, so it lands in the transient bucket and is
   * retried. That is the right call for a blip, but it does mean a permanently
   * wrong host costs the full retry budget before the failover chain moves on.
   */
  private classify(error: unknown): ClassifiedError {
    // Thrown by normalize() itself — a malformed body is a permanent
    // condition for this attempt, not something a retry can fix.
    if (error instanceof AppError) {
      return { permanent: true, error };
    }

    if (isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 429) {
        return {
          permanent: false,
          error: MarketOverviewErrors.providerRateLimited()
        };
      }

      if (status && status >= 500) {
        return {
          permanent: false,
          error: MarketOverviewErrors.providerUnavailable()
        };
      }

      if (status) {
        return {
          permanent: true,
          error: MarketOverviewErrors.providerBadRequest()
        };
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          permanent: false,
          error: MarketOverviewErrors.providerTimeout()
        };
      }
    }

    return {
      permanent: false,
      error: MarketOverviewErrors.providerUnavailable()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
