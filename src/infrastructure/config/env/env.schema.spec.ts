import { ConfigModule } from '@nestjs/config';
import { ENV_VALIDATION_SCHEMA } from './env.schema';

const VALID_ENV = {
  DATA_SOURCE_USERNAME: 'postgres',
  DATA_SOURCE_PASSWORD: 'postgres',
  DATA_SOURCE_HOST: 'localhost',
  DATA_SOURCE_PORT: 5432,
  DATA_SOURCE_DATABASE: 'test_db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  ACCESS_TOKEN_SECRET: 'xk7Fv9JpQm2Wb4Tr8Zs5Nx1Cv6Le8HyPf3Qd7Hu2',
  REFRESH_TOKEN_SECRET: 'vP4nTq9Xc2Lr7Zu5Ss6Ka8Yd1Bj3Hf0Rm4Wg6Ve1',
  CSRF_TOKEN_SECRET: 'sA6kL4oP8rM9xD1zB7eQ3nV2cF5jH0yTg6uW8pR2',
  NODE_ENV: 'test',
  MAX_ACTIVE_SESSIONS: 10
};

describe('Environment validation', () => {
  it.each([undefined, 0, -1, 1.5, 'invalid'])(
    'should reject MAX_ACTIVE_SESSIONS=%p',
    (maxActiveSessions) => {
      const { error } = ENV_VALIDATION_SCHEMA.validate({
        ...VALID_ENV,
        MAX_ACTIVE_SESSIONS: maxActiveSessions
      });

      expect(error?.message).toContain('MAX_ACTIVE_SESSIONS');
    }
  );

  it.each([5, 10, '7'])(
    'should accept MAX_ACTIVE_SESSIONS=%p',
    (maxActiveSessions) => {
      const { error, value } = ENV_VALIDATION_SCHEMA.validate({
        ...VALID_ENV,
        MAX_ACTIVE_SESSIONS: maxActiveSessions
      });

      expect(error).toBeUndefined();
      expect(value.MAX_ACTIVE_SESSIONS).toBe(Number(maxActiveSessions));
    }
  );

  it('should reject application configuration at startup when the limit is invalid', async () => {
    const previous = new Map<string, string | undefined>();

    for (const [key, value] of Object.entries({
      ...VALID_ENV,
      MAX_ACTIVE_SESSIONS: 0
    })) {
      previous.set(key, process.env[key]);
      process.env[key] = String(value);
    }

    try {
      await expect(
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          validationSchema: ENV_VALIDATION_SCHEMA
        })
      ).rejects.toThrow(/MAX_ACTIVE_SESSIONS/);
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
