import { User } from '@features/users/domain/entities/user.entity';
import { UserVerificationCode } from '@features/users/domain/entities/user-verification-code.entity';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { ApiClient } from '../helpers/api-client.helper';
import {
  getVerificationCode,
  getVerificationEmailCount,
  resetEmailStore
} from '../helpers/email.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
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

  it('sends a verification email with a 6-digit code on registration', async () => {
    const { user } = await UserFactory.register(app);

    const code = getVerificationCode(user.email);

    expect(code).toMatch(/^\d{6}$/);
    expect(await getStatus(user.email)).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it('verifies the email with the correct code', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);

    const res = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Email verified successfully');
    expect(await getStatus(user.email)).toBe(UserStatus.ACTIVATE);
  });

  it('allows login after email verification', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);

    const verify = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });
    expect(verify.status).toBe(200);

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

  it('rejects an expired code with 400', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);
    await expireLatestCode(user.email);

    const res = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXPIRED_VERIFICATION_CODE');
  });

  it('rejects verification for an already verified account with 409', async () => {
    const { user, client } = await UserFactory.register(app);
    const code = getVerificationCode(user.email);

    const first = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });
    expect(first.status).toBe(200);

    const second = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_VERIFIED');
  });

  it('resend issues a new code and invalidates the previous one', async () => {
    const { user, client } = await UserFactory.register(app);
    const oldCode = getVerificationCode(user.email);

    const resend = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email }
    });
    expect(resend.status).toBe(200);
    expect(resend.body.data.message).toContain(
      'verification code has been sent'
    );

    const newCode = getVerificationCode(user.email);
    expect(newCode).not.toBe(oldCode);

    const withOld = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code: oldCode }
    });
    expect(withOld.status).toBe(400);

    const withNew = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code: newCode }
    });
    expect(withNew.status).toBe(200);
  });

  it('does not resend while the cooldown is active', async () => {
    const { user, client } = await UserFactory.register(app);

    const first = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email }
    });
    expect(first.status).toBe(200);
    expect(getVerificationEmailCount(user.email)).toBe(2);

    const second = await client.post('/v1/auth/resend-verification', {
      body: { email: user.email }
    });
    expect(second.status).toBe(200);
    expect(getVerificationEmailCount(user.email)).toBe(2);
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

    const afterLimit = await client.post('/v1/auth/verify-email', {
      body: { email: user.email, code }
    });

    expect(afterLimit.status).toBe(400);
    expect(afterLimit.body.error.code).toBe('INVALID_VERIFICATION_CODE');
    expect(await getStatus(user.email)).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it('does not reveal whether an account exists on resend', async () => {
    const client = new ApiClient(app);

    const res = await client.post('/v1/auth/resend-verification', {
      body: { email: 'does-not-exist@test.com' }
    });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('verification code has been sent');
  });
});
