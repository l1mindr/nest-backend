import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
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
    const { user, cookie } = await createAuthenticatedUser(app);
    const res = await request(app.getHttpServer())
      .get('/v1/user/me')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.username).toBe(user.username);
    expect(res.body.data.role).toBeDefined();
    expect(res.body.data.registeredAt).toBeDefined();
  });

  it('should fail if user is not authenticated', async () => {
    const res = await request(app.getHttpServer()).get('/v1/user/me');

    expect(res.status).toBe(401);
  });

  it('should update profile', async () => {
    const { cookie } = await createAuthenticatedUser(app);
    const res = await request(app.getHttpServer())
      .put('/v1/user')
      .set('Cookie', cookie)
      .send({
        name: 'New name'
      });

    const getUpdateUser = await request(app.getHttpServer())
      .get('/v1/user/me')
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
    expect(getUpdateUser.body.data.name).toBe('New name');
  });
});
