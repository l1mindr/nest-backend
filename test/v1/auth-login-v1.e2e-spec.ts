import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { createUser } from '../factories/user.factory';
import { ApiClient } from '../helpers/apiClient-helper';
import { resetDatabase } from '../utils/database.helper';

describe('Auth Login (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const testApp = await createTestApp();

    app = testApp.app;
    dataSource = testApp.dataSource;
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should login successfully with email', async () => {
    const user = createUser();
    const client = new ApiClient(app);

    await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: user
    });

    const loginRes = await client.request({
      method: 'post',
      url: '/v1/auth/login',
      body: { email: user.email, password: user.password }
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.headers['set-cookie']).toBeDefined();
    expect(loginRes.headers['set-cookie'][0]).toContain('access-token');
  });

  it('should login successfully with username', async () => {
    const user = createUser();
    const client = new ApiClient(app);

    await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: user
    });

    const loginRes = await client.request({
      method: 'post',
      url: '/v1/auth/login',
      body: { email: user.username, password: user.password }
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.headers['set-cookie']).toBeDefined();
    expect(loginRes.headers['set-cookie'][0]).toContain('access-token');
  });

  it('should fail if email does not exist', async () => {
    const user = createUser({ email: 'wrong@test.com' });
    const client = new ApiClient(app);

    const res = await client.request({
      method: 'post',
      url: '/v1/auth/login',
      body: { email: user.email, password: user.password }
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('invalid credentials');
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should fail if password is wrong', async () => {
    const user = createUser();
    const client = new ApiClient(app);

    await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: user
    });

    const res = await client.request({
      method: 'post',
      url: '/v1/auth/login',
      body: { email: user.email, password: 'WrongPassword@123' }
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('invalid credentials');
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should fail if password is empty', async () => {
    const client = new ApiClient(app);
    const res = await client.request({
      method: 'post',
      url: '/v1/auth/login',
      body: {
        email: createUser().email,
        password: ''
      }
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  it('should fail if user not found by email or username', async () => {
    const client = new ApiClient(app);
    const res = await client.request({
      method: 'post',
      url: '/v1/auth/login',
      body: {
        email: 'unknown_value',
        password: createUser().password
      }
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('invalid credentials');
  });
});
