import { RateLimitPolicies } from '@features/security/rate-limit/config/rate-limit.config';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { createUserDto } from '../helpers/create-user.helper';
import { resetEmailStore } from '../helpers/email.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import {
  blockKeyFor,
  counterKeyFor,
  forceExpiry
} from '../helpers/rate-limit.helper';
import { clearRedis } from '../helpers/redis.helper';

const RATE_LIMIT_CODE = 'RATE_LIMIT_EXCEEDED';

describe('Rate limiting (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let client: ApiClient;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } =
      await createMigratedTestApp();

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
    resetEmailStore();
    client = new ApiClient(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  /**
   * Each octet is a distinct /24, so the derived device id changes with the
   * address. Use this to isolate a dimension that is not the device.
   */
  const distinctSubnet = (index: number) => `203.0.${index}.10`;

  /**
   * All inside 198.51.100.0/24, so every request shares one derived device id
   * while the address itself differs.
   */
  const sharedSubnet = (index: number) => `198.51.100.${index + 1}`;

  const login = (
    email: string,
    ip: string,
    headers: Record<string, string> = {}
  ) =>
    client.post('/v1/auth/login', {
      headers: { 'X-Forwarded-For': ip, ...headers },
      body: { email, password: 'Password@123' }
    });

  const verifyEmail = (email: string, code: string, ip: string) =>
    client.post('/v1/auth/verify-email', {
      headers: { 'X-Forwarded-For': ip },
      body: { email, code }
    });

  describe('identifier isolation', () => {
    it('should not let a rotating address bypass the per-email limit', async () => {
      const { limit } = RateLimitPolicies.Auth.Login.Email;
      const { user } = await UserFactory.register(app);

      // Every attempt from a different /24, so neither the address nor the
      // device rule can be what stops the caller.
      for (let i = 0; i < limit; i += 1) {
        const attempt = await login(user.email, distinctSubnet(i));
        expect(attempt.status).not.toBe(429);
      }

      const blocked = await login(user.email, distinctSubnet(limit));

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe(RATE_LIMIT_CODE);
      expect(blocked.headers['retry-after']).toBeDefined();
    });

    it('should not let a rotating email bypass the per-address limit', async () => {
      const { limit } = RateLimitPolicies.Auth.Login.IP;
      const ip = '203.0.113.10';

      for (let i = 0; i < limit; i += 1) {
        const attempt = await login(`rotating-${i}@test.com`, ip);
        expect(attempt.status).not.toBe(429);
      }

      const blocked = await login(`rotating-${limit}@test.com`, ip);

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe(RATE_LIMIT_CODE);
    });

    it('should not let an address rotating inside one subnet bypass the device limit', async () => {
      const { limit } = RateLimitPolicies.Auth.Login.Device;

      // A unique email each time and an address that changes within one /24:
      // the email rule never accumulates, and the address rule sees one hit per
      // address, so only the device dimension can stop this.
      for (let i = 0; i < limit; i += 1) {
        const attempt = await login(`device-${i}@test.com`, sharedSubnet(i));
        expect(attempt.status).not.toBe(429);
      }

      const blocked = await login(
        `device-${limit}@test.com`,
        sharedSubnet(limit)
      );

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe(RATE_LIMIT_CODE);
    });

    it('should honour a client-supplied device id across addresses and emails', async () => {
      const { limit } = RateLimitPolicies.Auth.Login.Device;
      const deviceId = 'device-fixed-abc123';

      for (let i = 0; i < limit; i += 1) {
        const attempt = await login(`header-${i}@test.com`, distinctSubnet(i), {
          'X-Device-Id': deviceId
        });
        expect(attempt.status).not.toBe(429);
      }

      const blocked = await login(
        `header-${limit}@test.com`,
        distinctSubnet(limit),
        { 'X-Device-Id': deviceId }
      );
      expect(blocked.status).toBe(429);

      // A different handle is a different bucket, which is the known trade-off
      // of trusting a client-supplied identifier.
      const rotated = await login(
        `header-rotated@test.com`,
        distinctSubnet(limit + 1),
        { 'X-Device-Id': 'device-rotated-xyz789' }
      );
      expect(rotated.status).not.toBe(429);
    });

    it('should count one verification code across many addresses', async () => {
      const { limit } = RateLimitPolicies.Auth.Verify.Code;
      const sharedCode = '111111';

      // A unique email and a unique /24 per attempt, so the only dimension that
      // accumulates is the code itself. This is the sweep an attacker would run
      // to guess one code against many accounts.
      for (let i = 0; i < limit; i += 1) {
        const attempt = await verifyEmail(
          `code-${i}@test.com`,
          sharedCode,
          distinctSubnet(i)
        );
        expect(attempt.status).not.toBe(429);
      }

      const blocked = await verifyEmail(
        `code-${limit}@test.com`,
        sharedCode,
        distinctSubnet(limit)
      );

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe(RATE_LIMIT_CODE);
    });
  });

  describe('window and block lifecycle', () => {
    it('should release the caller once the window expires', async () => {
      const rule = RateLimitPolicies.Auth.Register.IP;
      const ip = '203.0.113.20';

      for (let i = 0; i < rule.limit; i += 1) {
        await client.post('/v1/auth/register', {
          headers: { 'X-Forwarded-For': ip },
          body: createUserDto({
            email: `expiry-${i}@test.com`,
            username: `expiryuser${i}`
          })
        });
      }

      const blocked = await client.post('/v1/auth/register', {
        headers: { 'X-Forwarded-For': ip },
        body: createUserDto({
          email: 'expiry-blocked@test.com',
          username: 'expiryblocked'
        })
      });
      expect(blocked.status).toBe(429);

      // Collapse the real TTL instead of waiting out the window.
      await forceExpiry(app, counterKeyFor(app, rule, ip));

      const afterExpiry = await client.post('/v1/auth/register', {
        headers: { 'X-Forwarded-For': ip },
        body: createUserDto({
          email: 'expiry-after@test.com',
          username: 'expiryafter'
        })
      });

      expect(afterExpiry.status).not.toBe(429);
    });

    it('should keep a temporary block in force after its counter is gone', async () => {
      const rule = RateLimitPolicies.Auth.Login.Email;
      const { user } = await UserFactory.register(app);
      const identifier = user.email.toLowerCase();

      for (let i = 0; i <= rule.limit; i += 1) {
        await login(user.email, distinctSubnet(i));
      }

      // Deleting the counter proves the block is an independent key rather than
      // a side effect of the window still being open.
      await app
        .get(RedisService)
        .client.del(counterKeyFor(app, rule, identifier));

      const stillBlocked = await login(user.email, distinctSubnet(20));
      expect(stillBlocked.status).toBe(429);

      await forceExpiry(app, blockKeyFor(app, rule, identifier));

      const released = await login(user.email, distinctSubnet(21));
      expect(released.status).not.toBe(429);
    });
  });

  describe('concurrency', () => {
    it('should not let parallel requests over-consume the budget', async () => {
      const { limit } = RateLimitPolicies.Auth.Login.Email;
      const { user } = await UserFactory.register(app);
      const total = limit + 2;

      // Fired together, so the counter is only correct if the check and the
      // increment happen atomically inside one Redis script.
      const responses = await Promise.all(
        Array.from({ length: total }, (_unused, index) =>
          login(user.email, distinctSubnet(index))
        )
      );

      const statuses = responses.map((response) => response.status);

      expect(statuses.filter((status) => status === 429)).toHaveLength(
        total - limit
      );
      expect(statuses.filter((status) => status !== 429)).toHaveLength(limit);
    });
  });

  describe('when Redis is unavailable', () => {
    let evalSpy: jest.SpyInstance;

    beforeEach(() => {
      evalSpy = jest
        .spyOn(app.get(RedisService), 'eval')
        .mockRejectedValue(new Error('ECONNRESET'));
    });

    afterEach(() => {
      evalSpy.mockRestore();
    });

    it('should let a fail-open route through', () => {
      expect(RateLimitPolicies.Auth.Register.IP.failOpen).toBe(true);

      return client
        .post('/v1/auth/register', {
          headers: { 'X-Forwarded-For': '203.0.113.30' },
          body: createUserDto({
            email: 'degraded@test.com',
            username: 'degradeduser'
          })
        })
        .expect((response) => {
          expect(response.status).not.toBe(429);
        });
    });

    it('should reject a fail-closed route', async () => {
      expect(RateLimitPolicies.Auth.Login.IP.failOpen).toBe(false);

      const response = await login('anyone@test.com', '203.0.113.31');

      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe(RATE_LIMIT_CODE);
    });
  });

  describe('response headers', () => {
    it('should advertise the remaining budget on a permitted request', async () => {
      const response = await client.post('/v1/auth/register', {
        headers: { 'X-Forwarded-For': '203.0.113.40' },
        body: createUserDto({
          email: 'headers@test.com',
          username: 'headersuser'
        })
      });

      expect(Number(response.headers['x-ratelimit-limit'])).toBe(
        RateLimitPolicies.Auth.Register.IP.limit
      );
      expect(
        Number(response.headers['x-ratelimit-remaining'])
      ).toBeGreaterThanOrEqual(0);
      expect(Number(response.headers['x-ratelimit-reset'])).toBeGreaterThan(0);
    });

    it('should still advertise the budget on a rejected request', async () => {
      const { limit } = RateLimitPolicies.Auth.Login.IP;
      const ip = '203.0.113.41';

      for (let i = 0; i <= limit; i += 1) {
        await login(`headers-${i}@test.com`, ip);
      }

      const blocked = await login('headers-final@test.com', ip);

      expect(blocked.status).toBe(429);
      expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('unlimited routes', () => {
    it('should leave a route without a policy untouched', async () => {
      const responses = await Promise.all(
        Array.from({ length: 15 }, () => client.get('/v1/coins'))
      );

      expect(responses.every((response) => response.status !== 429)).toBe(true);
    });
  });
});
