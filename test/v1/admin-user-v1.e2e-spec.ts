import { User } from '@features/users/entities/user.entity';
import { UserRole } from '@features/users/enums/user-role.enum';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Admin Users (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Exact shape serialized by AdminUserResponseDto — toEqual also fails on
  // any extra or missing keys, so leaks of e.g. `password` are caught.
  const adminUserResponseShape = {
    id: expect.any(String),
    name: null,
    username: expect.any(String),
    email: expect.any(String),
    role: expect.any(String),
    status: expect.any(String),
    registeredAt: expect.any(String),
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
    deletedAt: null
  };

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

  it('admin should access to users list', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      {
        withRole: UserRole.ADMIN
      },
      dataSource
    );

    const userContext = await AuthFactory.authenticated(app, {
      overrides: {
        email: 'otherUser@test.com',
        username: 'otherUser',
        password: 'Password@123'
      }
    });

    const adminRes = await adminContext.client.get('/v1/admin/users');
    const userRes = await userContext.client.get('/v1/admin/users');
    expect(adminRes.status).toBe(200);
    expect(userRes.status).toBe(403);
  });

  it('GET /admin/users should return the exact AdminUserResponseDto shape', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    const res = await adminContext.client.get('/v1/admin/users');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual(adminUserResponseShape);
  });

  it('GET /admin/users/:id should return the complete AdminUserResponseDto', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    const target = await dataSource.getRepository(User).findOneOrFail({
      where: { email: adminContext.user.email }
    });

    const res = await adminContext.client.get(`/v1/admin/users/${target.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      ...adminUserResponseShape,
      id: target.id,
      username: adminContext.user.username,
      email: adminContext.user.email,
      role: UserRole.ADMIN,
      status: UserStatus.DEACTIVATE
    });
  });

  it('GET /admin/users/:id should return 404 for a missing user', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    const res = await adminContext.client.get(
      '/v1/admin/users/00000000-0000-4000-8000-000000000000'
    );

    expect(res.status).toBe(404);
  });

  it('GET /admin/users/:id should be forbidden for non-admin users', async () => {
    const userContext = await AuthFactory.authenticated(app, {});

    const res = await userContext.client.get(
      '/v1/admin/users/00000000-0000-4000-8000-000000000000'
    );

    expect(res.status).toBe(403);
  });
});
