import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('DTO validation hardening (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let client: ApiClient;

  const validBody = {
    email: 'test@test.com',
    username: 'testuser',
    password: 'Password@123'
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
    client = new ApiClient(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const expectValidationError = (res: {
    status: number;
    body: { error?: { code?: string } };
  }) => {
    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  };

  describe('POST /auth/register', () => {
    it.each([
      ['email as number', { email: 123 }],
      ['email as null', { email: null }],
      ['email as object', { email: { $gt: '' } }],
      ['email as array', { email: ['a@b.com'] }],
      ['username as number', { username: 12345 }],
      ['username as null', { username: null }],
      ['username as object', { username: { toString: 'x' } }],
      ['password as number', { password: 12345678 }],
      ['password as null', { password: null }],
      ['password as object', { password: {} }],
      ['name as number', { name: 42 }],
      ['name as object', { name: { first: 'a' } }]
    ])('rejects %s with 422', async (_label, override) => {
      const res = await client.post('/v1/auth/register', {
        body: { ...validBody, ...override }
      });

      expectValidationError(res);
    });

    it('still accepts a valid payload', async () => {
      const res = await client.post('/v1/auth/register', { body: validBody });

      expect(res.status).toBe(201);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await client.post('/v1/auth/register', { body: validBody });
      // Registered users are DEACTIVATE; verify email so valid-credential
      // logins reach 200 (validation-error cases fail before the status check).
      await UserFactory.verifyEmail(app, validBody.email);
    });

    it.each([
      ['email as number', { email: 123, password: validBody.password }],
      ['email as null', { email: null, password: validBody.password }],
      ['email as object', { email: {}, password: validBody.password }],
      ['password as number', { email: validBody.email, password: 123 }],
      ['password as null', { email: validBody.email, password: null }],
      ['password as object', { email: validBody.email, password: {} }]
    ])('rejects %s with 422', async (_label, body) => {
      const res = await client.post('/v1/auth/login', { body });

      expectValidationError(res);
    });

    it('still accepts a valid login', async () => {
      const res = await client.post('/v1/auth/login', {
        body: { email: validBody.email, password: validBody.password }
      });

      expect(res.status).toBe(200);
    });

    it('still trims and lowercases string identifiers', async () => {
      const res = await client.post('/v1/auth/login', {
        body: { email: '  TEST@TEST.COM  ', password: validBody.password }
      });

      expect(res.status).toBe(200);
    });
  });
});
