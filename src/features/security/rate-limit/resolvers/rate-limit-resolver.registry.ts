import { Inject, Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import {
  IRateLimitIdentifierResolver,
  RATE_LIMIT_RESOLVERS
} from './rate-limit-resolver.interface';

/**
 * Indexes the registered resolvers by identifier type.
 *
 * The lookup replaces what would otherwise be a switch: adding a dimension
 * means adding an enum member, a resolver class, and one entry in the module's
 * provider array — no existing resolver, the evaluator, the guard, the store,
 * or the key builder is touched.
 */
@Injectable()
export class RateLimitResolverRegistry {
  private readonly resolvers: ReadonlyMap<
    RateLimitIdentifier,
    IRateLimitIdentifierResolver
  >;

  constructor(
    @Inject(RATE_LIMIT_RESOLVERS)
    resolvers: readonly IRateLimitIdentifierResolver[]
  ) {
    const map = new Map<RateLimitIdentifier, IRateLimitIdentifierResolver>();

    for (const resolver of resolvers) {
      if (map.has(resolver.type)) {
        // Two resolvers for one dimension means one of them silently never
        // runs. Fail at boot rather than pick an arbitrary winner.
        throw new Error(
          `Duplicate rate limit resolver for identifier "${resolver.type}"`
        );
      }

      map.set(resolver.type, resolver);
    }

    this.resolvers = map;
  }

  get(type: RateLimitIdentifier): IRateLimitIdentifierResolver {
    const resolver = this.resolvers.get(type);

    if (!resolver) {
      // Unreachable while the config spec holds; a hard error still beats
      // degrading a configured route to unlimited.
      throw new Error(`No rate limit resolver registered for "${type}"`);
    }

    return resolver;
  }
}
