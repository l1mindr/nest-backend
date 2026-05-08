import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createUser } from '../factories/user.factory';

export async function registerUser(
  app: INestApplication,
  body: Partial<{
    email: string;
    username: string;
    password: string;
  }>
) {
  return await request(app.getHttpServer()).post('/auth/register').send(body);
}

export async function createAuthenticatedUser(
  app: INestApplication,
  overrides = {}
) {
  const user = createUser({ ...overrides });
  await registerUser(app, user);

  const loginRes = await loginUser(app, {
    email: user.email,
    password: user.password
  });

  const cookie = loginRes.headers['set-cookie'];

  return { user, cookie };
}

export async function loginUser(
  app: INestApplication,
  body: Partial<{
    email: string;
    password: string;
  }>
) {
  return request(app.getHttpServer()).post('/auth/login').send(body);
}

export function authenticatedRequest(app: INestApplication, token: string) {
  return request(app.getHttpServer()).set('Authorization', `Bearer ${token}`);
}
