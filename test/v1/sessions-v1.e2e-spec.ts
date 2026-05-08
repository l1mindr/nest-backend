import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { createUser } from '../factories/user.factory';
import { createAuthenticatedUser, loginUser } from '../utils/auth.helper';
import { resetDatabase } from '../utils/database.helper';

describe('Sessions (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const testApp = await createTestApp();

    app = testApp.app;
    app.useGlobalFilters({
      catch(e) {
        console.log('error', e);
        throw e;
      }
    });
    dataSource = testApp.dataSource;
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return active sessions', async () => {
    const { cookie } = await createAuthenticatedUser(app);
    const res = await request(app.getHttpServer())
      .get('/v1/sessions')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return 204 when logout successfully', async () => {
    const { cookie } = await createAuthenticatedUser(app);
    const resLogout = await request(app.getHttpServer())
      .delete('/v1/sessions')
      .set('Cookie', cookie);

    const resSessions = await request(app.getHttpServer())
      .get('/v1/sessions')
      .set('Cookie', cookie);
    expect(resLogout.status).toBe(204);
    expect(resSessions.status).toBe(401);
  });

  it('should terminate other sessions', async () => {
    const user = createUser();
    const { cookie } = await createAuthenticatedUser(app, user);

    await loginUser(app, {
      email: user.username,
      password: user.password
    });

    const resSessions = await request(app.getHttpServer())
      .get('/v1/sessions')
      .set('Cookie', cookie);

    expect(resSessions.status).toBe(200);
    expect(resSessions.body.data).toHaveLength(2);

    const resTerminateOtherSessions = await request(app.getHttpServer())
      .delete('/v1/sessions/others')
      .set('Cookie', cookie);

    expect(resTerminateOtherSessions.status).toBe(204);
  });
});
