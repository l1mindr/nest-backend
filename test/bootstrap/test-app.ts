import redisConfig from '@infrastructure/config/databases/redis.config';
import { REDIS_CLIENT } from '@infrastructure/databases/redis/redis.constants';
import { createRedisClient } from '@infrastructure/databases/redis/redis.provider';
import { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/bootstrap';
import { NestExpressApplication } from '@nestjs/platform-express';
import { runMigrations } from '../helpers/postgresql.helper';

export interface ITextContext {
  app: INestApplication;
  dataSource: DataSource;
}

export async function createTestApp(): Promise<ITextContext> {
  process.env.NODE_ENV = 'test';

  let moduleFixture: TestingModule | undefined;
  let app: NestExpressApplication | undefined;
  let redisClient: Redis | undefined;

  try {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(REDIS_CLIENT)
      .useFactory({
        factory: (config: ConfigType<typeof redisConfig>) => {
          redisClient = createRedisClient(config, {
            retryStrategy: () => null
          });

          return redisClient;
        },
        inject: [redisConfig.KEY]
      })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();

    await setupApp(app);
    await app.init();

    const dataSource = app.get(DataSource);

    return { app, dataSource };
  } catch (error) {
    const resource = app ?? moduleFixture;

    if (resource) {
      await closeAfterSetupFailure(resource, error, () =>
        redisClient?.disconnect()
      );
    }

    redisClient?.disconnect();

    throw error;
  }
}

export async function createMigratedTestApp(): Promise<ITextContext> {
  const context = await createTestApp();

  try {
    await runMigrations(context.dataSource);

    return context;
  } catch (error) {
    return closeAfterSetupFailure(context.app, error);
  }
}

async function closeAfterSetupFailure(
  resource: Pick<INestApplication, 'close'>,
  setupError: unknown,
  fallbackCleanup?: () => void
): Promise<never> {
  try {
    await resource.close();
  } catch (cleanupError) {
    fallbackCleanup?.();

    throw new AggregateError(
      [setupError, cleanupError],
      'Test application setup and cleanup both failed'
    );
  }

  throw setupError;
}
