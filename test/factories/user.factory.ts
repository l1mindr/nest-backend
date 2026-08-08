import { AdminPermission } from '@features/authorization/domain/entities/admin-permission.entity';
import {
  ALL_PERMISSIONS,
  Permission
} from '@features/authorization/domain/enums/permission.enum';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { ApiClient } from '../helpers/api-client.helper';
import { createUserDto } from '../helpers/create-user.helper';
import {
  CreateUserContext,
  CreateUserResponse
} from '../utils/types/factory.types';

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

  /**
   * Creates an already-active account with a legacy bcrypt password hash,
   * bypassing the API. Used by the password-hashing e2e spec to model a user
   * who registered before the Argon2id migration.
   */
  static async createWithBcryptPassword(
    app: INestApplication,
    dataSource: DataSource,
    overrides = {}
  ): Promise<CreateUserContext> {
    const user = createUserDto(overrides);
    const repo = dataSource.getRepository(User);

    await repo.save(
      repo.create({
        email: user.email.trim().toLowerCase(),
        username: user.username,
        password: bcrypt.hashSync(user.password, 4),
        name: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVATE
      })
    );

    return {
      user,
      client: new ApiClient(app),
      response: {} as CreateUserResponse
    };
  }

  /**
   * Registers an administrator.
   *
   * Permissions default to the full set: an administrator now holds nothing
   * until granted, and most specs are exercising something other than
   * authorization. Specs that *are* about authorization pass an explicit list
   * to model a support, moderator or read-only administrator.
   */
  static async admin(
    app: INestApplication,
    dataSource: DataSource,
    overrides = {},
    permissions: Permission[] = [...ALL_PERMISSIONS]
  ): Promise<CreateUserContext> {
    const context = await this.register(app, overrides);
    const user = await this.promote(
      dataSource,
      context.user.email,
      UserRole.ADMIN
    );

    await this.grant(dataSource, user.id, permissions);

    return context;
  }

  /**
   * Registers the single owner. Permissions are never granted: the owner
   * bypasses evaluation rather than holding anything.
   */
  static async owner(
    app: INestApplication,
    dataSource: DataSource,
    overrides = {}
  ): Promise<CreateUserContext> {
    const context = await this.register(app, overrides);

    await this.promote(dataSource, context.user.email, UserRole.OWNER);

    return context;
  }

  static async grant(
    dataSource: DataSource,
    userId: string,
    permissions: readonly Permission[]
  ): Promise<void> {
    if (permissions.length === 0) return;

    const repo = dataSource.getRepository(AdminPermission);

    await repo
      .createQueryBuilder()
      .insert()
      .into(AdminPermission)
      .values(
        permissions.map((permission) => ({
          userId,
          permission,
          grantedById: null
        }))
      )
      .orIgnore()
      .execute();
  }

  private static async promote(
    dataSource: DataSource,
    email: string,
    role: UserRole
  ): Promise<User> {
    const repo = dataSource.getRepository(User);
    const normalized = email.trim().toLowerCase();

    await repo.update({ email: normalized }, { role });

    return repo.findOneOrFail({ where: { email: normalized } });
  }
}
