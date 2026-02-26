import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { registerUser } from '../utils/auth.helper';
import { resetDatabase, runMigrations } from '../utils/database.helper';

describe('Auth (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    await runMigrations(dataSource);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
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
    expect(responseUsername.body.message).toBe(
      'username must be a valid username'
    );
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
    const res = await registerUser(app, {
      email: 'test@test.com',
      username: 'username',
      password: 'Password@123'
    });

    expect(res.status).toBe(201);
  });

  it('should not register duplicate email', async () => {
    expect(
      (
        await registerUser(app, {
          email: 'dup@test.com',
          username: 'user1',

          password: 'Password@123'
        })
      ).status
    ).toBe(201);

    const res = await registerUser(app, {
      email: 'dup@test.com',
      username: 'user1',
      password: 'Password@123'
    });

    expect(res.body.message).toBe('email already exists');
    expect(res.body.error).toBe('Unprocessable Entity');
    expect(res.status).toBe(422);
  });

  it('should not register duplicate username', async () => {
    expect(
      (
        await registerUser(app, {
          email: 'user1@test.com',
          username: 'dup_user',
          password: 'Password@123'
        })
      ).status
    ).toBe(201);

    const res = await registerUser(app, {
      email: 'user2@test.com',
      username: 'dup_user',
      password: 'Password@123'
    });

    expect(res.body.message).toBe('username already exists');
    expect(res.body.error).toBe('Unprocessable Entity');
    expect(res.status).toBe(422);
  });
});
