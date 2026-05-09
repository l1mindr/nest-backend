import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { createUser } from '../factories/user.factory';
import { createAuthenticatedUser } from '../utils/auth.helper';
import { resetDatabase } from '../utils/database.helper';

describe('Sessions (e2e) version: 1', () => {
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

  it('should return active sessions', async () => {
    const userClient = await createAuthenticatedUser(app);
    const res = await userClient.request({
      method: 'get',
      url: '/v1/sessions'
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return 204 when logout successfully', async () => {
    const userClient = await createAuthenticatedUser(app);
    const logoutRes = await userClient.request({
      method: 'delete',
      url: '/v1/sessions'
    });

    const meRes = await userClient.request({
      method: 'get',
      url: '/v1/user/me'
    });
    expect(logoutRes.status).toBe(204);
    expect(meRes.status).toBe(401);
  });

  it('should terminate other sessions', async () => {
    const user = createUser();
    const userClient = await createAuthenticatedUser(app, user);

    await userClient.request({
      method: 'post',
      url: '/v1/auth/login',
      body: {
        email: user.username,
        password: user.password
      }
    });

    const sessionsRes = await userClient.request({
      method: 'get',
      url: '/v1/sessions'
    });

    expect(sessionsRes.status).toBe(200);
    expect(sessionsRes.body.data).toHaveLength(2);

    const terminateOtherSessionsRes = await userClient.request({
      method: 'delete',
      url: '/v1/sessions/others'
    });

    expect(terminateOtherSessionsRes.status).toBe(204);
  });
});
