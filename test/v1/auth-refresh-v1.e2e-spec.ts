import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { resetDatabase } from '../helpers/database.helper';
import { getCookie, normalizeHeader } from '../utils/cookie.util';

describe('Auth Refresh (e2e) version: 1', () => {
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

  it('should refresh token successfully', async () => {
    const { response } = await UserFactory.authenticated(app, {
      loginBy: 'email'
    });

    const refreshCookie = getCookie(
      normalizeHeader(response.login.headers['set-cookie']),
      'refresh_token'
    );

    const res = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('access_token');
    expect(res.headers['set-cookie'][1]).toContain('refresh_token');
  });

  it('should detect refresh token reuse', async () => {
    const { response } = await UserFactory.authenticated(app, {
      loginBy: 'email'
    });

    const refreshCookie = getCookie(
      normalizeHeader(response.login.headers['set-cookie']),
      'refresh_token'
    );

    const firstRefresh = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(firstRefresh.status).toBe(200);

    const reuseAttempt = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(reuseAttempt.status).toBe(401);
  });

  it('should block concurrent refresh requests', async () => {
    const { response } = await UserFactory.authenticated(app, {
      loginBy: 'email'
    });

    const refreshCookie = getCookie(
      normalizeHeader(response.login.headers['set-cookie']),
      'refresh_token'
    );

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', refreshCookie),

      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', refreshCookie)
    ]);

    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([200, 429]);
  });
});
