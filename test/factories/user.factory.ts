import { User } from '@features/users/entities/user.entity';
import { UserRole } from '@features/users/enums/user-role.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiClient } from '../helpers/apiClient-helper';
import { createUser } from '../helpers/create-user.helper';
import { AuthenticatedOptions } from '../utils/types/auth.types';
import {
  AuthenticatedUserContext,
  CreateUserContext
} from '../utils/types/factory.types';

export class UserFactory {
  static async create(
    app: INestApplication,
    overrides = {}
  ): Promise<CreateUserContext> {
    const user = createUser(overrides);
    const client = new ApiClient(app);

    const register = await client.request({
      method: 'post',
      url: '/v1/auth/register',
      body: user
    });

    return {
      user,
      client,
      response: {
        register
      }
    };
  }

  static async authenticated(
    app: INestApplication,
    options: AuthenticatedOptions
  ): Promise<AuthenticatedUserContext> {
    const context = await this.create(app, options.overrides);
    const identifier = options.loginBy ?? 'email';

    const login = await context.client.request({
      method: 'post',
      url: '/v1/auth/login',
      body: {
        email:
          identifier === 'email' ? context.user.email : context.user.username,
        password: context.user.password
      }
    });

    return {
      ...context,
      response: {
        ...context.response,
        login
      }
    };
  }

  static async admin(
    app: INestApplication,
    dataSource: DataSource,
    overrides = {}
  ): Promise<AuthenticatedUserContext> {
    const context = await this.authenticated(app, overrides);
    const repo = dataSource.getRepository(User);

    await repo.update(
      { email: context.user.email },
      {
        role: UserRole.ADMIN
      }
    );

    return context;
  }
}
