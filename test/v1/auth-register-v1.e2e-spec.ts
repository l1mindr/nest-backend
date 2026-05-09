import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { createUser } from '../factories/user.factory';
import { ApiClient } from '../helpers/apiClient-helper';
import { resetDatabase } from '../utils/database.helper';

describe('Auth Register (e2e) version: 1', () => {
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

  it('should fail if data is invalid', async () => {
    const user = createUser();
    const client = new ApiClient(app);

    const emailRes = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: {
        email: 'test.com',
        username: user.username,
        password: user.password
      }
    });
    expect(emailRes.body.message).toBe('email must be an email');
    expect(emailRes.body.error).toBe('Bad Request');
    expect(emailRes.status).toBe(400);

    const usernameRes = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: {
        email: user.email,
        username: 'user@name',
        password: user.password
      }
    });
    expect(usernameRes.body.message).toBe('username must be a valid');
    expect(usernameRes.body.error).toBe('Bad Request');
    expect(usernameRes.status).toBe(400);

    const passwordRes = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: {
        email: user.email,
        username: user.username,
        password: 'password'
      }
    });
    expect(passwordRes.body.message).toBe('password must be valid');
    expect(passwordRes.body.error).toBe('Bad Request');
    expect(passwordRes.status).toBe(400);
  });

  it('should register a new user', async () => {
    const user = createUser();
    const client = new ApiClient(app);

    const res = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: user
    });

    expect(res.status).toBe(201);
  });

  it('should not register duplicate email', async () => {
    const user = createUser();
    const client = new ApiClient(app);

    const registerUserRes = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: user
    });
    const registerUserAgainRes = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: user
    });

    expect(registerUserRes.status).toBe(201);
    expect(registerUserAgainRes.body.message).toBe('email already exists');
    expect(registerUserAgainRes.body.error).toBe('Unprocessable Entity');
    expect(registerUserAgainRes.status).toBe(422);
  });

  it('should not register duplicate username', async () => {
    const user = createUser();
    const client = new ApiClient(app);
    const registerUserRes = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: user
    });
    const registerUserAgainRes = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: createUser({ email: 'test1@test.com' })
    });

    expect(registerUserRes.status).toBe(201);
    expect(registerUserAgainRes.body.message).toBe('username already exists');
    expect(registerUserAgainRes.body.error).toBe('Unprocessable Entity');
    expect(registerUserAgainRes.status).toBe(422);
  });
});
