export const FEAR_GREED_PORT = Symbol('FearGreedPort');

/**
 * Crypto Fear & Greed Index snapshot as reported by the external sentiment
 * source, already mapped to the application's vocabulary. `value` is the raw
 * 0-100 index; `updatedAt` is when the provider published this value, not
 * when this application fetched it. `nextUpdateAt` is `null` when the
 * provider does not report one.
 */
export interface FearGreedEntry {
  value: number;
  classification: string;
  updatedAt: Date;
  nextUpdateAt: Date | null;
}

export interface FearGreedPort {
  fetchFearGreedIndex(): Promise<FearGreedEntry>;
}

/**
 * A {@link FearGreedEntry} plus freshness metadata about how this particular
 * response was served. `fetchedAt` is when *this backend* last successfully
 * called alternative.me — distinct from `updatedAt`, which is when the
 * provider itself published the index. `isStale` is true only when the
 * provider call for this request failed and a previously-cached value was
 * served instead of failing the request.
 */
export interface FearGreedSnapshot extends FearGreedEntry {
  fetchedAt: Date;
  isStale: boolean;
}

export const GET_FEAR_GREED_USE_CASE = Symbol('IGetFearGreedUseCase');

export interface IGetFearGreedUseCase {
  execute(): Promise<FearGreedSnapshot>;
}
