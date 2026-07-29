import { User } from '@features/users/domain/entities/user.entity';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Auth Status Enforcement (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const getUser = (email: string) =>
    dataSource.getRepository(User).findOneOrFail({ where: { email } });

  const setStatus = (email: string, status: UserStatus) =>
    dataSource.getRepository(User).update({ email }, { status });

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } =
      await createMigratedTestApp();

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers users with UserStatus.PENDING_VERIFICATION', async () => {
    const { user } = await UserFactory.register(app);

    const persisted = await getUser(user.email);

    expect(persisted.status).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it('rejects login for unverified (PENDING_VERIFICATION) user with 403', async () => {
    const { user, client } = await UserFactory.register(app);

    const res = await client.post('/v1/auth/login', {
      body: { email: user.email, password: user.password }
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
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

  it('rejects login for a DEACTIVATE user with generic 401', async () => {
    const { user, client } = await UserFactory.register(app);
    await setStatus(user.email, UserStatus.DEACTIVATE);

    const res = await client.post('/v1/auth/login', {
      body: { email: user.email, password: user.password }
    });

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects login for a SUSPEND user with generic 401', async () => {
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

    const before = await client.get('/v1/user/me');
    expect(before.status).toBe(200);

    await setStatus(user.email, UserStatus.SUSPEND);

    const after = await client.get('/v1/user/me');
    expect(after.status).toBe(401);
  });
});
