import { User } from '@features/users/entities/user.entity';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Auth Status Enforcement (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const getUser = (email: string) =>
    dataSource.getRepository(User).findOneOrFail({ where: { email } });

  const setStatus = (email: string, status: UserStatus) =>
    dataSource.getRepository(User).update({ email }, { status });

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } = await createTestApp();
    await runMigrations(testDataSource);

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers users with UserStatus.DEACTIVATE', async () => {
    const { user } = await UserFactory.register(app);

    const persisted = await getUser(user.email);

    expect(persisted.status).toBe(UserStatus.DEACTIVATE);
  });

  it('rejects login for a newly registered (DEACTIVATE) user and issues no tokens', async () => {
    const { user, client } = await UserFactory.register(app);

    const res = await client.post('/v1/auth/login', {
      body: { email: user.email, password: user.password }
    });

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('allows login after email verification promotes the user to ACTIVATE', async () => {
    const { user, client } = await UserFactory.register(app);

    await UserFactory.verifyEmail(app, user.email);

    const res = await client.post('/v1/auth/login', {
      body: { email: user.email, password: user.password }
    });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toContain('access_token');
    expect(res.headers['set-cookie'][1]).toContain('refresh_token');
  });

  it('rejects login for a SUSPEND user and issues no tokens', async () => {
    const { user, client } = await UserFactory.register(app);
    await setStatus(user.email, UserStatus.SUSPEND);

    const res = await client.post('/v1/auth/login', {
      body: { email: user.email, password: user.password }
    });

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('invalidates an existing access token once the account is suspended', async () => {
    const { user, client } = await UserFactory.register(app);
    await UserFactory.verifyEmail(app, user.email);

    const login = await client.post('/v1/auth/login', {
      body: { email: user.email, password: user.password }
    });

    expect(login.status).toBe(200);

    // The access token is still valid and unexpired: the request agent keeps
    // the access_token cookie, so this call reuses the exact JWT minted above.
    const before = await client.get('/v1/user/me');
    expect(before.status).toBe(200);

    await setStatus(user.email, UserStatus.SUSPEND);

    const after = await client.get('/v1/user/me');
    expect(after.status).toBe(401);
  });
});
