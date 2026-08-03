export interface RateLimitResult {
  /** Policy name, e.g. `auth.login.ip`. */
  readonly policy: string;
  readonly allowed: boolean;
  readonly limit: number;
  /** Requests left in the window; 0 once the limit is reached or a block is open. */
  readonly remaining: number;
  /** Epoch milliseconds at which the window (or block) lifts. */
  readonly resetAt: number;
  readonly retryAfterSeconds: number;
  /** A temporary block was active, or was opened by this request. */
  readonly blocked: boolean;
  /** Redis was unreachable; `failOpen` decided the outcome. */
  readonly degraded: boolean;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  /**
   * The rule that denied the request, or — when allowed — the passing rule with
   * the least headroom, which is what the response headers advertise. Null when
   * every rule was skipped.
   */
  readonly result: RateLimitResult | null;
  readonly retryAfterSeconds: number;
}
