import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { runMigrations, truncateDatabase } from '../helpers/database.helper';

describe('Auth Register (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } = await createTestApp();
    await runMigrations(testDataSource);

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should fail if data is invalid', async () => {
    const checkEmailUser = await UserFactory.register(app, {
      email: 'test.com'
    });
    const checkUsernameUser = await UserFactory.register(app, {
      username: 'user@name'
    });
    const checkPasswordUser = await UserFactory.register(app, {
      password: 'password'
    });

    expect(checkEmailUser.response.register.status).toBe(422);
    expect(checkUsernameUser.response.register.status).toBe(422);
    expect(checkPasswordUser.response.register.status).toBe(422);
  });

  it('should register a new user', async () => {
    const {
      response: { register }
    } = await UserFactory.register(app);

    expect(register.status).toBe(201);
  });

  it('should not register duplicate email', async () => {
    const context1 = await UserFactory.register(app);
    const context2 = await UserFactory.register(app);

    expect(context1.response.register.status).toBe(201);
    expect(context2.response.register.status).toBe(422);
  });

  it('should not register duplicate username', async () => {
    const context1 = await UserFactory.register(app);
    const context2 = await UserFactory.register(app, {
      email: 'test1@test.com'
    });

    expect(context1.response.register.status).toBe(201);
    expect(context2.response.register.status).toBe(422);
  });
});
