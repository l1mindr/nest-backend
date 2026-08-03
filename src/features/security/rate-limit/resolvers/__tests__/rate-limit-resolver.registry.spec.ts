import { RateLimitIdentifier } from '../../types/rate-limit-identifier.enum';
import { IRateLimitIdentifierResolver } from '../rate-limit-resolver.interface';
import { RateLimitResolverRegistry } from '../rate-limit-resolver.registry';

const stub = (
  type: RateLimitIdentifier,
  value: string | null = 'value'
): IRateLimitIdentifierResolver => ({
  type,
  resolve: () => value
});

describe('RateLimitResolverRegistry', () => {
  it('should index resolvers by identifier type', () => {
    const ip = stub(RateLimitIdentifier.IP);
    const email = stub(RateLimitIdentifier.EMAIL);

    const registry = new RateLimitResolverRegistry([ip, email]);

    expect(registry.get(RateLimitIdentifier.IP)).toBe(ip);
    expect(registry.get(RateLimitIdentifier.EMAIL)).toBe(email);
  });

  it('should reject duplicate resolvers for one dimension', () => {
    // Two resolvers for one type means one silently never runs; that must be a
    // boot failure, not an arbitrary winner.
    expect(
      () =>
        new RateLimitResolverRegistry([
          stub(RateLimitIdentifier.IP),
          stub(RateLimitIdentifier.IP)
        ])
    ).toThrow('Duplicate rate limit resolver for identifier "ip"');
  });

  it('should throw for an unregistered dimension', () => {
    const registry = new RateLimitResolverRegistry([
      stub(RateLimitIdentifier.IP)
    ]);

    expect(() => registry.get(RateLimitIdentifier.EMAIL)).toThrow(
      'No rate limit resolver registered for "email"'
    );
  });

  it('should accept an empty resolver list without throwing at construction', () => {
    expect(() => new RateLimitResolverRegistry([])).not.toThrow();
  });
});
