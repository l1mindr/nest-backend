import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { resetDatabase } from '../helpers/database.helper';

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
    const { client } = await UserFactory.authenticated(app, {});

    const res = await client.request({
      method: 'get',
      url: '/v1/sessions'
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return 204 when logout successfully', async () => {
    const { client } = await UserFactory.authenticated(app, {});

    const logoutRes = await client.request({
      method: 'delete',
      url: '/v1/sessions'
    });

    const meRes = await client.request({
      method: 'get',
      url: '/v1/user/me'
    });

    expect(logoutRes.status).toBe(204);
    expect(meRes.status).toBe(401);
  });

  it('should terminate other sessions', async () => {
    const context1 = await UserFactory.authenticated(app, {});

    await UserFactory.authenticated(app, {});

    const sessionsRes = await context1.client.request({
      method: 'get',
      url: '/v1/sessions'
    });

    expect(sessionsRes.status).toBe(200);
    expect(sessionsRes.body.data).toHaveLength(2);

    const terminateOtherSessionsRes = await context1.client.request({
      method: 'delete',
      url: '/v1/sessions/others'
    });

    expect(terminateOtherSessionsRes.status).toBe(204);
  });
});
