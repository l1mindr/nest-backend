import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { resetDatabase } from '../helpers/database.helper';

describe('Auth Register (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const testApp = await createTestApp();

    app = testApp.app;
    dataSource = testApp.dataSource;
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should fail if data is invalid', async () => {
    const checkEmailUser = await UserFactory.create(app, { email: 'test.com' });
    const checkUsernameUser = await UserFactory.create(app, {
      username: 'user@name'
    });
    const checkPasswordUser = await UserFactory.create(app, {
      password: 'password'
    });

    expect(checkEmailUser.response.register.status).toBe(422);
    expect(checkUsernameUser.response.register.status).toBe(422);
    expect(checkPasswordUser.response.register.status).toBe(422);
  });

  it('should register a new user', async () => {
    const {
      response: { register }
    } = await UserFactory.create(app);

    expect(register.status).toBe(201);
  });

  it('should not register duplicate email', async () => {
    const context1 = await UserFactory.create(app);
    const context2 = await UserFactory.create(app);

    expect(context1.response.register.status).toBe(201);
    expect(context2.response.register.status).toBe(422);
  });

  it('should not register duplicate username', async () => {
    const context1 = await UserFactory.create(app);
    const context2 = await UserFactory.create(app, { email: 'test1@test.com' });

    expect(context1.response.register.status).toBe(201);
    expect(context2.response.register.status).toBe(422);
  });
});
