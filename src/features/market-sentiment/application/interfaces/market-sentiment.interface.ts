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

export const GET_FEAR_GREED_USE_CASE = Symbol('IGetFearGreedUseCase');

export interface IGetFearGreedUseCase {
  execute(): Promise<FearGreedEntry>;
}
