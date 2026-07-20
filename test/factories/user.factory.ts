import { User } from '@features/users/entities/user.entity';
import { UserRole } from '@features/users/enums/user-role.enum';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiClient } from '../helpers/api-client.helper';
import { createUserDto } from '../helpers/create-user.helper';
import { CreateUserContext } from '../utils/types/factory.types';

export class UserFactory {
  static async register(
    app: INestApplication,
    overrides = {}
  ): Promise<CreateUserContext> {
    const user = createUserDto(overrides);
    const client = new ApiClient(app);

    const register = await client.post('/v1/auth/register', { body: user });

    return {
      user,
      client,
      response: {
        register
      }
    };
  }

  static async verifyEmail(
    app: INestApplication,
    email: string
  ): Promise<void> {
    const repo = app.get(DataSource).getRepository(User);

    // Emails are trimmed + lowercased on registration, so normalize the
    // lookup to match the persisted row (overrides may use mixed case).
    await repo.update(
      { email: email.trim().toLowerCase() },
      { status: UserStatus.ACTIVATE }
    );
  }

  static async admin(
    app: INestApplication,
    dataSource: DataSource,
    overrides = {}
  ): Promise<CreateUserContext> {
    const context = await this.register(app, overrides);
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
