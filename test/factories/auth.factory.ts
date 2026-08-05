import { UserRole } from '@features/users/domain/enums/user-role.enum';
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
    const context = await this.create(app, options, dataSource);

    await UserFactory.verifyEmail(app, context.user.email);

    return this.login(context, options.loginBy);
  }

  private static create(
    app: INestApplication,
    options: AuthenticatedOptions,
    dataSource?: DataSource
  ): Promise<CreateUserContext> {
    if (options.withRole === UserRole.USER || options.withRole === undefined) {
      return UserFactory.register(app, options.overrides);
    }

    if (!dataSource) {
      throw new Error(
        `A DataSource is required to create a ${options.withRole} account.`
      );
    }

    if (options.withRole === UserRole.OWNER) {
      return UserFactory.owner(app, dataSource, options.overrides);
    }

    return UserFactory.admin(
      app,
      dataSource,
      options.overrides,
      options.withPermissions
    );
  }
}
