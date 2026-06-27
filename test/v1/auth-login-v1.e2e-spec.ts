import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { runMigrations, truncateDatabase } from '../helpers/database.helper';

describe('Auth Login (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } = await createTestApp();
    await runMigrations(testDataSource);

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should login successfully with email', async () => {
    const {
      response: { login }
    } = await UserFactory.authenticated(app, {
      loginBy: 'email'
    });

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeDefined();
    expect(login.headers['set-cookie'][0]).toContain('access_token');
    expect(login.headers['set-cookie'][1]).toContain('refresh_token');
  });

  it('should login successfully with username', async () => {
    const {
      response: { login }
    } = await UserFactory.authenticated(app, { loginBy: 'username' });

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeDefined();
    expect(login.headers['set-cookie'][0]).toContain('access_token');
    expect(login.headers['set-cookie'][1]).toContain('refresh_token');
  });

  it('should fail if email does not exist', async () => {
    const { user, client } = await UserFactory.create(app);

    const res = await client.post('/v1/auth/login', {
      body: { email: 'wrong@test.com', password: user.password }
    });

    expect(res.status).toBe(401);
  });

  it('should fail if password is wrong', async () => {
    const { user, client } = await UserFactory.create(app);

    const res = await client.post('/v1/auth/login', {
      body: { email: user.email, password: 'WrongPassword@123' }
    });

    expect(res.status).toBe(401);
  });

  it('should fail if password is empty', async () => {
    const { user, client } = await UserFactory.create(app);
    const res = await client.post('/v1/auth/login', {
      body: {
        email: user.email,
        password: null
      }
    });

    expect(res.status).toBe(422);
  });

  it('should fail if user not found by email or username', async () => {
    const { user, client } = await UserFactory.create(app);

    const res = await client.post('/v1/auth/login', {
      body: {
        email: 'unknown_value',
        password: user.password
      }
    });

    expect(res.status).toBe(401);
  });
});
