import { HashingProvider } from '@features/auth/infrastructure/providers/hashing.provider';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { bootstrapOwner } from '../../scripts/seed-owner';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { UserFactory } from '../factories/user.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { clearRedis } from '../helpers/redis.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';

describe('Owner Bootstrap (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let hashingProvider: HashingProvider;

  const email = 'owner@example.com';
  const password = 'Owner@12345';

  const countOwners = async (): Promise<number> =>
    dataSource.getRepository(User).count({ where: { role: UserRole.OWNER } });

  const findOwner = () =>
    dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.role = :role', { role: UserRole.OWNER })
      .getOneOrFail();

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } =
      await createMigratedTestApp();

    app = testApp;
    dataSource = testDataSource;
    hashingProvider = app.get(HashingProvider);
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('creation', () => {
    it('creates an OWNER with ACTIVATE status and a hashed password when none exists', async () => {
      const outcome = await bootstrapOwner(
        { dataSource, hashingProvider },
        email,
        password
      );

      expect(outcome.created).toBe(true);
      expect(outcome.email).toBe(email);

      const owner = await findOwner();
      expect(owner.email).toBe(email);
      expect(owner.role).toBe(UserRole.OWNER);
      expect(owner.status).toBe(UserStatus.ACTIVATE);

      expect(owner.password).not.toBe(password);
      expect(owner.password).toMatch(/^\$argon2/i);
      expect(await hashingProvider.compare(password, owner.password)).toBe(
        true
      );
    });

    it('leaves exactly one Owner in the database', async () => {
      await bootstrapOwner({ dataSource, hashingProvider }, email, password);
      expect(await countOwners()).toBe(1);
    });

    it('rejects a raw second OWNER insert at the database level', async () => {
      await bootstrapOwner({ dataSource, hashingProvider }, email, password);
      const repo = dataSource.getRepository(User);
      const hash = await hashingProvider.hash(password);

      await expect(
        repo.save(
          repo.create({
            email: 'second@example.com',
            username: 'second',
            password: hash,
            name: null,
            role: UserRole.OWNER,
            status: UserStatus.ACTIVATE
          })
        )
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  describe('idempotency', () => {
    it('does not create a second Owner when one already exists', async () => {
      await bootstrapOwner({ dataSource, hashingProvider }, email, password);

      const second = await bootstrapOwner(
        { dataSource, hashingProvider },
        email,
        password
      );

      expect(second.created).toBe(false);
      expect(await countOwners()).toBe(1);
    });
  });

  describe('authentication', () => {
    it('lets the Owner log in through the normal login endpoint and get tokens', async () => {
      await bootstrapOwner({ dataSource, hashingProvider }, email, password);
      const client = new ApiClient(app);

      const login = await client.post('/v1/auth/login', {
        body: { email, password }
      });

      expect(login.status).toBe(200);
      const joined = (login.headers['set-cookie'] as unknown as string[]).join(
        ','
      );
      expect(joined).toContain('access_token');
      expect(joined).toContain('refresh_token');
    });

    it('recognizes the Owner on a permission-protected route (owner bypass)', async () => {
      await bootstrapOwner({ dataSource, hashingProvider }, email, password);
      const client = new ApiClient(app);

      const login = await client.post('/v1/auth/login', {
        body: { email, password }
      });
      expect(login.status).toBe(200);

      // Reads are not behind CSRF; the agent persists the auth cookies.
      const res = await client.get('/v1/admin/administrators');
      expect(res.status).toBe(200);
    });
  });

  describe('security', () => {
    it('rejects a role/status escalation attempt on public registration', async () => {
      // The global ValidationPipe forbids unknown body fields entirely, so a
      // client cannot even smuggle `role`/`status` into the request.
      const context = await UserFactory.register(app, {
        role: UserRole.OWNER,
        status: UserStatus.ACTIVATE
      });
      expect(context.response.register.status).toBe(422);
      expect(await countOwners()).toBe(0);
    });

    it('registers an ordinary USER who cannot reach owner-reserved routes', async () => {
      const context = await UserFactory.register(app);
      expect(context.response.register.status).toBe(201);

      const persisted = await dataSource
        .getRepository(User)
        .findOneOrFail({ where: { email: context.user.email } });

      expect(persisted.role).toBe(UserRole.USER);
      expect(await countOwners()).toBe(0);

      await UserFactory.verifyEmail(app, context.user.email);
      await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: context.user.password }
      });
      const res = await context.client.get('/v1/admin/administrators');
      expect(res.status).toBe(403);
    });
  });

  describe('existing accounts', () => {
    it('keeps existing normal USER login working', async () => {
      const context = await AuthFactory.authenticated(app, {
        loginBy: 'email'
      });
      expect(context.response.login.status).toBe(200);
    });

    it('keeps existing ADMIN behavior working', async () => {
      const context = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.ADMIN },
        dataSource
      );
      expect(context.response.login.status).toBe(200);

      const res = await context.client.get('/v1/admin/users');
      expect(res.status).toBe(200);
    });
  });
});
