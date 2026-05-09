import { User } from '@features/users/entities/user.entity';
import { UserRole } from '@features/users/enums/user-role.enum';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createUser } from '../factories/user.factory';
import { ApiClient } from '../helpers/apiClient-helper';

export async function registerUser(
  app: INestApplication,
  body: Partial<{
    email: string;
    username: string;
    password: string;
  }>
) {
  const user = new ApiClient(app);
  await user.request({
    method: 'post',
    url: '/v1/auth/register',
    body
  });
  return user;
}

export async function loginUser(
  app: INestApplication,
  body: Partial<{
    email: string;
    password: string;
  }>
) {
  const user = new ApiClient(app);
  await user.request({
    method: 'post',
    url: '/v1/auth/login',
    body
  });
  return user;
}

export async function createAuthenticatedUser(
  app: INestApplication,
  overrides = {}
) {
  const user = createUser({ ...overrides });
  const client = new ApiClient(app);

  await client.request({
    method: 'post',
    url: '/v1/auth/register',
    body: user
  });

  await client.request({
    method: 'post',
    url: '/v1/auth/login',
    body: { email: user.email, password: user.password }
  });

  return client;
}

export async function createAdminUserAndLogin(
  app: INestApplication,
  dataSource: DataSource
) {
  const user = createUser({ email: 'admin@test.com' });
  await registerUser(app, user);

  const repo = dataSource.getRepository(User);

  await repo.update(
    {
      email: user.email
    },
    {
      role: UserRole.ADMIN
    }
  );

  // const loginRes = await loginUser(app, {
  //   email: user.email,
  //   password: user.password
  // });

  return new ApiClient(app);
}
export function authenticatedRequest(app: INestApplication, token: string) {
  return request(app.getHttpServer()).set('Authorization', `Bearer ${token}`);
}
