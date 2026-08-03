import { Request } from 'express';
import { RateLimitIdentifier } from './rate-limit-identifier.enum';

export interface RateLimitResolutionContext {
  readonly request: Request;
  /** `AuthController.loginUser` — stable, free of query string and version prefix. */
  readonly routeKey: string;
  readonly rule: RateLimitRule;
}

export interface RateLimitRule {
  /** Namespaced policy name, e.g. `auth.login.ip`. Appears in logs, never in responses. */
  readonly name: string;
  readonly identifier: RateLimitIdentifier;
  /** Redis key segment: `rl:{keyPrefix}:{identifier}:{hash}`. */
  readonly keyPrefix: string;
  readonly limit: number;
  readonly windowMs: number;
  /** 0 = no separate block key; the fixed window alone gates the caller. */
  readonly blockDurationMs: number;
  readonly enabled: boolean;
  /** true = allow through when Redis is unreachable; false = deny. */
  readonly failOpen: boolean;
  /** Required for, and only meaningful to, `RateLimitIdentifier.CUSTOM`. */
  readonly keyGenerator?: (
    context: RateLimitResolutionContext
  ) => string | null;
}

/** A route's policy set — every rule must pass for the request to proceed. */
export type RateLimitPolicyGroup = Readonly<Record<string, RateLimitRule>>;

/** Shape of `RateLimitPolicies`: feature -> route -> dimension -> rule. */
export type RateLimitPolicyTree = Readonly<
  Record<string, Readonly<Record<string, RateLimitPolicyGroup>>>
>;

export interface RateLimitMetadata {
  readonly rules: readonly RateLimitRule[];
}
