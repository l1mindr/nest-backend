import { User } from '@features/users/domain/entities/user.entity';
import { UserVerificationCode } from '@features/users/domain/entities/user-verification-code.entity';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import {
  ImperativeRateLimitPolicies,
  RateLimitPolicies
} from '@features/security/rate-limit/config/rate-limit.config';
import { INestApplication } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { ApiClient } from '../helpers/api-client.helper';
import {
  getVerificationCode,
  getVerificationEmailCount,
  getVerificationTtlMinutes,
  resetEmailStore
} from '../helpers/email.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { resetPolicy } from '../helpers/rate-limit.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Auth Verification (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
  });

  afterAll(async () => {
    await app?.close();
  });

  const getStatus = async (email: string) => {
    const user = await dataSource
      .getRepository(User)
      .findOneOrFail({ where: { email } });

    return user.status;
  };

  const expireLatestCode = async (email: string) => {
    const user = await dataSource
      .getRepository(User)
      .findOneOrFail({ where: { email } });

    await dataSource
      .getRepository(UserVerificationCode)
      .update(
        { userId: user.id, verifiedAt: IsNull() },
        { expiresAt: new Date(Date.now() - 60_000) }
      );
  };

  // Rate-limit keys are HMAC'd, so these go through the framework rather than
  // building a Redis key by hand.
  const clearEmailRateLimit = async (email: string) => {
    await resetPolicy(
      app,
      RateLimitPolicies.Auth.Verify.Email,
      email.toLowerCase()
    );
  };

  const clearResendCooldown = async (email: string) => {
    await resetPolicy(
      app,
      ImperativeRateLimitPolicies.ResendCooldown,
      email.toLowerCase()
    );
    await resetPolicy(
      app,
      RateLimitPolicies.Auth.Resend.Email,
      email.toLowerCase()
    );
  };

  it('sends a verification email with a 6-digit code that expires in 3 minutes', async () => {
    const { user } = await UserFactory.register(app);

    const code = getVerificationCode(user.email);

    expect(code).toMatch(/^\d{6}$/);
    expect(getVerificationTtlMinutes(user.email)).toBe(3);
    expect(await getStatus(user.email)).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it('verifies the email with the correct code', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);

    const res = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });

    expect(res.status).toBe(204);
    expect(await getStatus(user.email)).toBe(UserStatus.ACTIVATE);
  });

  it('allows login after email verification', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);

    const verify = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });
    expect(verify.status).toBe(204);

    const login = await client.post('/v1/auth/login', {
      body: { email: user.email, password: user.password }
    });

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toContain('access_token');
  });

  it('rejects an incorrect code with 400', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);
    const wrongCode = code === '000000' ? '000001' : '000000';

    const res = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code: wrongCode }
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_VERIFICATION_CODE');
    expect(await getStatus(user.email)).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it('rejects an expired code with the generic invalid code error', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);
    await expireLatestCode(user.email);

    const res = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_VERIFICATION_CODE');
  });

  it('consumes the code on success so it cannot be reused', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);

    const first = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });
    expect(first.status).toBe(204);

    const second = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });

    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('INVALID_VERIFICATION_CODE');
  });

  it('resend issues a new code and invalidates the previous one', async () => {
    const { user, client } = await UserFactory.register(app);
    const oldCode = getVerificationCode(user.email);

    const resend = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email }
    });
    expect(resend.status).toBe(204);

    const newCode = getVerificationCode(user.email);
    expect(newCode).not.toBe(oldCode);

    const withOld = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code: oldCode }
    });
    expect(withOld.status).toBe(400);

    const withNew = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code: newCode }
    });
    expect(withNew.status).toBe(204);
  });

  it('returns 429 when resending within the 2-minute cooldown', async () => {
    const { user, client } = await UserFactory.register(app);

    const first = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email }
    });
    expect(first.status).toBe(204);
    expect(getVerificationEmailCount(user.email)).toBe(2);

    const second = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email }
    });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(getVerificationEmailCount(user.email)).toBe(2);
  });

  it('allows resend after the 2-minute cooldown expires', async () => {
    const { user, client } = await UserFactory.register(app);

    const first = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email }
    });
    expect(first.status).toBe(204);

    await clearResendCooldown(user.email);

    const second = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email }
    });
    expect(second.status).toBe(204);
    expect(getVerificationEmailCount(user.email)).toBe(3);
  });

  it('stops resending once the hourly limit is reached', async () => {
    const { user } = await UserFactory.register(app);
    const client = new ApiClient(app);

    for (let i = 0; i < 5; i += 1) {
      await clearResendCooldown(user.email);

      const resend = await client.post('/v1/auth/resend-verification', {
        headers: { 'X-Forwarded-For': `198.51.100.${i + 1}` },
        body: { email: user.email }
      });
      expect(resend.status).toBe(204);
    }

    expect(getVerificationEmailCount(user.email)).toBe(6);

    await clearResendCooldown(user.email);

    const blocked = await client.post('/v1/auth/resend-verification', {
      headers: { 'X-Forwarded-For': '198.51.100.99' },
      body: { email: user.email }
    });
    expect(blocked.status).toBe(204);
    expect(getVerificationEmailCount(user.email)).toBe(6);
  });

  it('invalidates the code after the maximum number of failed attempts', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);

    for (let i = 0; i < 5; i += 1) {
      const attempt = await client.post('/v1/auth/verify-email', {
        body: { email: user.email, code: '000000' }
      });
      expect(attempt.status).toBe(400);
    }

    await clearEmailRateLimit(user.email);

    const afterLimit = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });

    expect(afterLimit.status).toBe(400);
    expect(afterLimit.body.error.code).toBe('INVALID_VERIFICATION_CODE');
    expect(await getStatus(user.email)).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it('blocks further attempts once the email rate limit is reached', async () => {
    const { user, client } = await UserFactory.register(app);

    for (let i = 0; i < 5; i += 1) {
      const attempt = await client.post('/v1/auth/verify-email', {
        body: { email: user.email, code: '000000' }
      });
      expect(attempt.status).toBe(400);
    }

    const blocked = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code: '000000' }
    });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('keeps the email rate limit across IP rotations', async () => {
    const { user } = await UserFactory.register(app);
    const client = new ApiClient(app);

    for (let i = 0; i < 5; i += 1) {
      const attempt = await client.post('/v1/auth/verify-email', {
        headers: { 'X-Forwarded-For': `203.0.113.${i + 1}` },
        body: { email: user.email, code: '000000' }
      });
      expect(attempt.status).toBe(400);
    }

    const blocked = await client.post('/v1/auth/verify-email', {
      headers: { 'X-Forwarded-For': '203.0.113.99' },
      body: { email: user.email, code: '000000' }
    });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('does not reveal whether an account exists on resend', async () => {
    const client = new ApiClient(app);

    const res = await client.post('/v1/auth/resend-verification', {
      body: { email: 'does-not-exist@test.com' }
    });

    expect(res.status).toBe(204);
  });

  it('only allows one concurrent resend request to succeed', async () => {
    const { user } = await UserFactory.register(app);
    const client = new ApiClient(app);

    const [first, second] = await Promise.all([
      client.post('/v1/auth/resend-verification', {
        body: { email: user.email }
      }),
      client.post('/v1/auth/resend-verification', {
        body: { email: user.email }
      })
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([204, 429]);
    expect(getVerificationEmailCount(user.email)).toBe(2);
  });

  it('leaves only one active verification code after concurrent resends', async () => {
    const { user } = await UserFactory.register(app);
    const client = new ApiClient(app);

    await Promise.all([
      client.post('/v1/auth/resend-verification', {
        body: { email: user.email }
      }),
      client.post('/v1/auth/resend-verification', {
        body: { email: user.email }
      })
    ]);

    const activeCodes = await dataSource
      .getRepository(UserVerificationCode)
      .count({
        where: {
          userId: (
            await dataSource
              .getRepository(User)
              .findOneOrFail({ where: { email: user.email } })
          ).id,
          verifiedAt: IsNull()
        }
      });

    expect(activeCodes).toBe(1);
  });

  it('rate-limits by normalised email address', async () => {
    const { user } = await UserFactory.register(app);
    const client = new ApiClient(app);

    const first = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email.toUpperCase() }
    });
    expect(first.status).toBe(204);

    const second = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email.toLowerCase() }
    });
    expect(second.status).toBe(429);
  });
});
