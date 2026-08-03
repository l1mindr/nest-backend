import { Request } from 'express';
import { RateLimitIdentifier } from '../../types/rate-limit-identifier.enum';
import {
  RateLimitResolutionContext,
  RateLimitRule
} from '../../types/rate-limit-rule.interface';
import { CustomKeyResolver } from '../custom-key.resolver';
import { DeviceIdResolver } from '../device-id.resolver';
import { EmailResolver } from '../email.resolver';
import { IpResolver } from '../ip.resolver';
import { RouteResolver } from '../route.resolver';
import { SessionIdResolver } from '../session-id.resolver';
import { UserIdResolver } from '../user-id.resolver';
import { UsernameResolver } from '../username.resolver';
import { VerificationCodeResolver } from '../verification-code.resolver';

const RULE: RateLimitRule = {
  name: 'test.rule.dimension',
  identifier: RateLimitIdentifier.IP,
  keyPrefix: 'test',
  limit: 5,
  windowMs: 60_000,
  blockDurationMs: 0,
  enabled: true,
  failOpen: true
};

const contextFor = (
  request: Partial<Request>,
  rule: RateLimitRule = RULE,
  routeKey = 'AuthController.loginUser'
): RateLimitResolutionContext => ({
  request: request as Request,
  routeKey,
  rule
});

describe('IpResolver', () => {
  const resolver = new IpResolver();

  it('should own the address dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.IP);
  });

  it('should return the request address', () => {
    expect(resolver.resolve(contextFor({ ip: '203.0.113.10' }))).toBe(
      '203.0.113.10'
    );
  });

  it('should return null when the address is absent', () => {
    expect(resolver.resolve(contextFor({ ip: undefined }))).toBeNull();
  });
});

describe('DeviceIdResolver', () => {
  const resolver = new DeviceIdResolver();

  it('should own the device dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.DEVICE);
  });

  it('should return the resolved device id', () => {
    expect(
      resolver.resolve(contextFor({ device: { deviceId: 'abc123' } as any }))
    ).toBe('abc123');
  });

  it('should return null when the middleware left no device', () => {
    expect(resolver.resolve(contextFor({ device: undefined }))).toBeNull();
  });

  it('should return null when the device carries no id', () => {
    expect(resolver.resolve(contextFor({ device: {} as any }))).toBeNull();
  });
});

describe('UserIdResolver', () => {
  const resolver = new UserIdResolver();

  it('should own the user dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.USER);
  });

  it('should return the authenticated user id', () => {
    expect(
      resolver.resolve(contextFor({ user: { id: 'user-1' } as any }))
    ).toBe('user-1');
  });

  it('should return null on a public route', () => {
    expect(resolver.resolve(contextFor({ user: undefined }))).toBeNull();
  });
});

describe('SessionIdResolver', () => {
  const resolver = new SessionIdResolver();

  it('should own the session dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.SESSION);
  });

  it('should return the session id', () => {
    expect(
      resolver.resolve(contextFor({ session: { id: 'session-1' } as any }))
    ).toBe('session-1');
  });

  it('should return null on a public route', () => {
    expect(resolver.resolve(contextFor({ session: undefined }))).toBeNull();
  });
});

describe('RouteResolver', () => {
  const resolver = new RouteResolver();

  it('should own the route dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.ROUTE);
  });

  it('should return the route key', () => {
    expect(
      resolver.resolve(contextFor({}, RULE, 'AuthController.verifyEmail'))
    ).toBe('AuthController.verifyEmail');
  });
});

describe('EmailResolver', () => {
  const resolver = new EmailResolver();

  it('should own the email dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.EMAIL);
  });

  it('should normalise the address to lower case', () => {
    expect(
      resolver.resolve(contextFor({ body: { email: '  User@Test.COM ' } }))
    ).toBe('user@test.com');
  });

  it.each([
    ['a missing field', {}],
    ['a number', { email: 12345 }],
    ['an array', { email: ['user@test.com'] }],
    ['an operator object', { email: { $ne: null } }],
    ['an empty string', { email: '' }]
  ])('should return null for %s', (_case, body) => {
    expect(resolver.resolve(contextFor({ body }))).toBeNull();
  });

  it('should return null when there is no body at all', () => {
    expect(resolver.resolve(contextFor({ body: undefined }))).toBeNull();
  });
});

describe('UsernameResolver', () => {
  const resolver = new UsernameResolver();

  it('should own the username dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.USERNAME);
  });

  it('should normalise the username to lower case', () => {
    expect(
      resolver.resolve(contextFor({ body: { username: ' TestUser ' } }))
    ).toBe('testuser');
  });

  it('should return null when absent', () => {
    expect(resolver.resolve(contextFor({ body: {} }))).toBeNull();
  });
});

describe('VerificationCodeResolver', () => {
  const resolver = new VerificationCodeResolver();

  it('should own the verification code dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.VERIFICATION_CODE);
  });

  it('should trim but preserve case', () => {
    expect(resolver.resolve(contextFor({ body: { code: ' AbC123 ' } }))).toBe(
      'AbC123'
    );
  });

  it('should return null when absent', () => {
    expect(resolver.resolve(contextFor({ body: {} }))).toBeNull();
  });

  it('should return null for a non-string code', () => {
    expect(resolver.resolve(contextFor({ body: { code: 123456 } }))).toBeNull();
  });
});

describe('CustomKeyResolver', () => {
  const resolver = new CustomKeyResolver();

  it('should own the custom dimension', () => {
    expect(resolver.type).toBe(RateLimitIdentifier.CUSTOM);
  });

  it('should delegate to the rule generator', () => {
    const rule: RateLimitRule = {
      ...RULE,
      identifier: RateLimitIdentifier.CUSTOM,
      keyGenerator: ({ request }) =>
        `${(request.body as any).code}:${(request.body as any).email}`
    };

    expect(
      resolver.resolve(
        contextFor({ body: { code: '123456', email: 'user@test.com' } }, rule)
      )
    ).toBe('123456:user@test.com');
  });

  it('should return null when the generator opts out', () => {
    const rule: RateLimitRule = {
      ...RULE,
      identifier: RateLimitIdentifier.CUSTOM,
      keyGenerator: () => null
    };

    expect(resolver.resolve(contextFor({}, rule))).toBeNull();
  });

  it('should return null when no generator is configured', () => {
    const rule: RateLimitRule = {
      ...RULE,
      identifier: RateLimitIdentifier.CUSTOM
    };

    expect(resolver.resolve(contextFor({}, rule))).toBeNull();
  });
});
