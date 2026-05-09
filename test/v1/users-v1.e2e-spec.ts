import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { ApiClient } from '../helpers/apiClient-helper';
import { createAuthenticatedUser } from '../utils/auth.helper';
import { resetDatabase } from '../utils/database.helper';

describe('Users (e2e) version: 1', () => {
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

  it('should get current user profile', async () => {
    const user = await createAuthenticatedUser(app);
    const res = await user.request({
      method: 'get',
      url: '/v1/user/me'
    });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBeDefined();
    expect(res.body.data.username).toBeDefined();
    expect(res.body.data.role).toBeDefined();
    expect(res.body.data.registeredAt).toBeDefined();
  });

  it('should fail if user is not authenticated', async () => {
    const client = new ApiClient(app);
    const res = await client.request({
      method: 'get',
      url: '/v1/user/me'
    });

    expect(res.status).toBe(401);
  });

  it('should update profile', async () => {
    const userClient = await createAuthenticatedUser(app);
    const res = await userClient.request({
      method: 'put',
      url: '/v1/user',
      body: {
        name: 'New name'
      }
    });

    const updateUserDataRes = await userClient.request({
      method: 'get',
      url: '/v1/user/me'
    });

    expect(res.status).toBe(204);
    expect(updateUserDataRes.body.data.name).toBe('New name');
  });
});
