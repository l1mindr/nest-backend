import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { createUser } from '../factories/user.factory';
import { registerUser } from '../utils/auth.helper';
import { resetDatabase } from '../utils/database.helper';

describe('Auth Register (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

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
    const responseEmail = await registerUser(app, {
      email: 'test.com',
      username: 'username',
      password: 'Password@123'
    });
    expect(responseEmail.body.message).toBe('email must be an email');
    expect(responseEmail.body.error).toBe('Bad Request');
    expect(responseEmail.status).toBe(400);

    const responseUsername = await registerUser(app, {
      email: 'tset@test.com',
      username: 'user@name',
      password: 'Password@123'
    });
    expect(responseUsername.body.message).toBe('username must be a valid');
    expect(responseUsername.body.error).toBe('Bad Request');
    expect(responseUsername.status).toBe(400);

    const responsePassword = await registerUser(app, {
      email: 'tset@test.com',
      username: 'username',

      password: 'password'
    });
    expect(responsePassword.body.message).toBe('password must be valid');
    expect(responsePassword.body.error).toBe('Bad Request');
    expect(responsePassword.status).toBe(400);
  });

  it('should register a new user', async () => {
    const user = createUser();
    const res = await registerUser(app, user);

    expect(res.status).toBe(201);
  });

  it('should not register duplicate email', async () => {
    const user = createUser();
    expect((await registerUser(app, user)).status).toBe(201);

    const res = await registerUser(app, user);

    expect(res.body.message).toBe('email already exists');
    expect(res.body.error).toBe('Unprocessable Entity');
    expect(res.status).toBe(422);
  });

  it('should not register duplicate username', async () => {
    const user = createUser();
    expect((await registerUser(app, { ...user })).status).toBe(201);

    const res = await registerUser(
      app,
      createUser({ email: 'test1@test.com' })
    );

    expect(res.body.message).toBe('username already exists');
    expect(res.body.error).toBe('Unprocessable Entity');
    expect(res.status).toBe(422);
  });
});
