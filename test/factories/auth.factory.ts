import { UserRole } from '@features/users/enums/user-role.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  getCookie,
  getCookieValue,
  normalizeHeader
} from '../utils/cookie.util';
import { AuthenticatedOptions } from '../utils/types/auth.types';
import {
  AuthenticatedUserContext,
  CreateUserContext
} from '../utils/types/factory.types';
import { UserFactory } from './user.factory';

export class AuthFactory {
  static async login(
    context: CreateUserContext,
    loginBy: 'email' | 'username' = 'email'
  ): Promise<AuthenticatedUserContext> {
    const identifier =
      loginBy === 'email' ? context.user.email : context.user.username;

    const login = await context.client.post('/v1/auth/login', {
      body: {
        email: identifier,
        password: context.user.password
      }
    });

    const cookies = normalizeHeader(login.headers['set-cookie']);

    const refreshToken = getCookie(cookies, 'refresh_token');

    const csrfToken = getCookie(cookies, 'csrf_token');
    const xCsrfToken = getCookieValue(cookies, 'csrf_token');

    return {
      ...context,
      response: {
        ...context.response,
        login,
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    };
  }

  static async authenticated(
    app: INestApplication,
    options: AuthenticatedOptions = {},
    dataSource?: DataSource
  ): Promise<AuthenticatedUserContext> {
    let context: CreateUserContext;

    if (options.withRole === UserRole.ADMIN) {
      if (!dataSource) {
        throw new Error('A DataSource is required to create an admin user.');
      }

      context = await UserFactory.admin(app, dataSource, options.overrides);
    }

    context = await UserFactory.register(app, options.overrides);

    return this.login(context, options.loginBy);
  }
}
