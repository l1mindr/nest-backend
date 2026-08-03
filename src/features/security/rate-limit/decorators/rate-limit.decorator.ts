import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY } from '../rate-limit.constants';
import {
  RateLimitMetadata,
  RateLimitPolicyGroup,
  RateLimitRule
} from '../types/rate-limit-rule.interface';

export interface RateLimitPolicyList {
  readonly policies: readonly RateLimitRule[];
}

export type RateLimitInput = RateLimitPolicyGroup | RateLimitPolicyList;

const isPolicyList = (input: RateLimitInput): input is RateLimitPolicyList =>
  Array.isArray((input as RateLimitPolicyList).policies);

const toRules = (input: RateLimitInput): readonly RateLimitRule[] =>
  isPolicyList(input) ? input.policies : Object.values(input);

/**
 * Applies every rule in a policy group to the decorated route, or to every
 * route of the decorated controller. All rules must pass; the first denial
 * answers 429.
 *
 * Takes either a named group from the central configuration:
 *
 *   @RateLimit(RateLimitPolicies.Auth.Login)
 *
 * or an explicit list, for combining policies across groups:
 *
 *   @RateLimit({ policies: [
 *     RateLimitPolicies.Auth.Login.IP,
 *     RateLimitPolicies.Auth.Login.Email
 *   ] })
 *
 * The rules are stored as object references rather than names, so the guard
 * reads them straight back out of the metadata with no lookup table, and a
 * custom rule's key generator closure survives intact.
 */
export const RateLimit = (input: RateLimitInput) =>
  SetMetadata<string, RateLimitMetadata>(RATE_LIMIT_KEY, {
    rules: toRules(input)
  });
