import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';

/** Injection token for the resolver array the registry indexes. */
export const RATE_LIMIT_RESOLVERS = Symbol('IRateLimitIdentifierResolver[]');

export interface IRateLimitIdentifierResolver {
  /** The identifier type this resolver owns. Exactly one resolver per type. */
  readonly type: RateLimitIdentifier;

  /**
   * The normalised identifier value, or `null` when the request carries nothing
   * for this dimension.
   *
   * `null` means "skip this rule", never "deny". Denying on a missing value
   * would turn every malformed request into a 429 and hand an attacker a lever
   * to reject traffic; the safety net is the config invariant that every policy
   * group also carries a dimension which always resolves.
   */
  resolve(context: RateLimitResolutionContext): string | null;
}
