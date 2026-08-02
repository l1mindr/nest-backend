import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
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

  it('GET /admin/users should return paginated response with items and nextCursor', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    const res = await adminContext.client.get('/v1/admin/users');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('nextCursor');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toEqual(adminUserResponseShape);
    expect(res.body.nextCursor).toBeNull();
  });

  it('GET /admin/users with limit=1 should paginate multiple users', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    // Create additional users directly in the database
    const repo = dataSource.getRepository(User);
    const users: User[] = [];
    for (let i = 0; i < 3; i++) {
      const u = repo.create({
        email: `extra${i}@test.com`,
        username: `extrauser${i}`,
        password: 'hashed',
        role: UserRole.USER,
        status: UserStatus.ACTIVATE
      });
      users.push(await repo.save(u));
    }

    // First page
    const page1 = await adminContext.client.get('/v1/admin/users', {
      query: { limit: '1' }
    });
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(1);
    expect(page1.body.nextCursor).toBeDefined();
    expect(page1.body.nextCursor).not.toBeNull();

    // Second page
    const page2 = await adminContext.client.get('/v1/admin/users', {
      query: { limit: '1', cursor: page1.body.nextCursor }
    });
    expect(page2.status).toBe(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.nextCursor).toBeDefined();

    // Collect all IDs across all pages
    const allIds: string[] = [page1.body.items[0].id];
    let cursor: string | null = page1.body.nextCursor;

    while (cursor) {
      const page = await adminContext.client.get('/v1/admin/users', {
        query: { limit: '1', cursor }
      });
      expect(page.status).toBe(200);
      for (const item of page.body.items) {
        allIds.push(item.id);
      }
      cursor = page.body.nextCursor;
    }

    // Should have 1 admin + 3 created = 4 users total
    expect(allIds).toHaveLength(4);
    // No duplicates
    expect(new Set(allIds).size).toBe(4);
  });

  it('GET /admin/users with invalid cursor should return 400', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    const res = await adminContext.client.get('/v1/admin/users', {
      query: { cursor: '!!!invalid!!!' }
    });

    expect(res.status).toBe(400);
  });

  it('GET /admin/users with limit=0 should return 422', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    const res = await adminContext.client.get('/v1/admin/users', {
      query: { limit: '0' }
    });

    expect(res.status).toBe(422);
  });

  it('GET /admin/users with limit exceeding max should return 422', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    const res = await adminContext.client.get('/v1/admin/users', {
      query: { limit: '101' }
    });

    expect(res.status).toBe(422);
  });

  it('GET /admin/users with cursor pointing past all users should return empty items', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    // Use a UUID that sorts after any random v4 UUID
    const cursor = Buffer.from(
      'ffffffff-ffff-4fff-bfff-ffffffffffff',
      'utf-8'
    ).toString('base64url');

    const res = await adminContext.client.get('/v1/admin/users', {
      query: { cursor }
    });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.nextCursor).toBeNull();
  });

  it('GET /admin/users should maintain deterministic ordering across pages', async () => {
    const adminContext = await AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN },
      dataSource
    );

    const repo = dataSource.getRepository(User);
    for (let i = 0; i < 5; i++) {
      await repo.save(
        repo.create({
          email: `order${i}@test.com`,
          username: `orderuser${i}`,
          password: 'hashed',
          role: UserRole.USER,
          status: UserStatus.ACTIVATE
        })
      );
    }

    // Fetch all at once
    const allRes = await adminContext.client.get('/v1/admin/users', {
      query: { limit: '100' }
    });
    const allIds = allRes.body.items.map((u: { id: string }) => u.id);

    // Fetch page by page
    const pagedIds: string[] = [];
    let cursor: string | null = null;
    do {
      const params: Record<string, string> = { limit: '2' };
      if (cursor) params.cursor = cursor;
      const page = await adminContext.client.get('/v1/admin/users', {
        query: params
      });
      for (const item of page.body.items) {
        pagedIds.push(item.id);
      }
      cursor = page.body.nextCursor;
    } while (cursor);

    expect(pagedIds).toEqual(allIds);
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
    expect(res.body).toEqual({
      ...adminUserResponseShape,
      id: target.id,
      username: adminContext.user.username,
      email: adminContext.user.email,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVATE
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
