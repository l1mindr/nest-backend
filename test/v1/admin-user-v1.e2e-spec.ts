import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { resetDatabase } from '../utils/database.helper';

describe('Admin Users (e2e) version: 1', () => {
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

  it('admin should access to users list', async () => {
    const adminContext = await UserFactory.admin(app, dataSource);
    const userContext = await UserFactory.authenticated(app, {
      overrides: {
        email: 'otherUser@test.com',
        username: 'otherUser',
        password: 'Password@123'
      }
    });

    const adminRes = await adminContext.client.request({
      method: 'get',
      url: '/v1/admin/users'
    });
    const userRes = await userContext.client.request({
      method: 'get',
      url: '/v1/admin/users'
    });
    expect(adminRes.status).toBe(200);
    expect(userRes.status).toBe(403);
  });
});
