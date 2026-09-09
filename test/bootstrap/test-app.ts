import redisConfig from '@infrastructure/config/databases/redis.config';
import { REDIS_CLIENT } from '@infrastructure/databases/redis/redis.constants';
import { createRedisClient } from '@infrastructure/databases/redis/redis.provider';
import { EMAIL_TRANSPORT } from '@infrastructure/email/email.constants';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { EmailService } from '@infrastructure/email/email.service';
import { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { Transporter } from 'nodemailer';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/bootstrap';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  capturingEmailPublisher,
  capturingEmailService
} from '../helpers/email.helper';

export interface ITextContext {
  app: INestApplication;
  dataSource: DataSource;
}

/**
 * Which email pipeline the application under test runs.
 *
 * `captured` is the default and what nearly every spec wants: the queue and the
 * provider are both replaced, so a use case's decision to send is observable
 * the instant the request returns. See `helpers/email.helper.ts`.
 *
 * `delivered` leaves the real one in place — `BullEmailPublisher` onto BullMQ,
 * `EmailProcessor` off it, `SmtpEmailService` through nodemailer to whatever
 * `EMAIL_HOST` names, which under `.env.test` is Mailpit. Delivery is then
 * asynchronous and the assertion is the message itself, read back over
 * Mailpit's API. Used by the specs in `test/email/`.
 */
export type TestEmailMode = 'captured' | 'delivered';

export interface TestAppOptions {
  /** Defaults to `captured`. */
  email?: TestEmailMode;

  /**
   * Replaces the SMTP transport, leaving the rest of the delivered pipeline
   * intact.
   *
   * Only for the retry spec, which needs a server whose replies it chooses.
   * It is still a real nodemailer transport speaking real SMTP — the point is
   * to control the *server*, not to stub the client. Ignored unless
   * {@link email} is `delivered`.
   */
  smtpTransport?: Transporter;
}

export async function createTestApp(
  options: TestAppOptions = {}
): Promise<ITextContext> {
  process.env.NODE_ENV = 'test';

  const { email = 'captured', smtpTransport } = options;

  let moduleFixture: TestingModule | undefined;
  let app: NestExpressApplication | undefined;
  let redisClient: Redis | undefined;

  try {
    let builder = Test.createTestingModule({
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
      });

    if (email === 'captured') {
      builder = builder
        .overrideProvider(EmailService)
        .useValue(capturingEmailService)
        .overrideProvider(EmailPublisher)
        .useValue(capturingEmailPublisher);
    } else if (smtpTransport) {
      builder = builder
        .overrideProvider(EMAIL_TRANSPORT)
        .useValue(smtpTransport);
    }

    moduleFixture = await builder.compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();

    await setupApp(app);

    // `init()` wires the application up but never binds a socket, and supertest
    // opens an ephemeral listener of its own for any server that is not already
    // listening — then closes it again once the response completes. That is a
    // bind/close pair per request, and a close that lands while a concurrent
    // request is still in flight surfaces as a stray `ECONNRESET`. Listening
    // once per spec makes supertest reuse this address for every request.
    await app.listen(0);

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

/**
 * Schema preparation now happens once per worker database in the Jest global
 * setup, so this only has to hand back an application connected to an already
 * migrated database. It stays as a distinct entry point to keep the intent of
 * each spec explicit: specs that touch tables use this, the rest use
 * {@link createTestApp}.
 */
export async function createMigratedTestApp(
  options: TestAppOptions = {}
): Promise<ITextContext> {
  return createTestApp(options);
}

/**
 * Closes the pooled SMTP connections a `delivered` run opened.
 *
 * `createSmtpTransport` sets `pool: true`, so nodemailer keeps sockets alive
 * between messages — the right thing for a process that sends email all day and
 * an open handle that outlives the suite in one that does not. Nest never sees
 * the transport as something to shut down (it is a plain value provider), so
 * closing it is the caller's job.
 *
 * Harmless for a `captured` run: nothing ever connected, and `close()` on an
 * idle pool is a no-op.
 */
export function releaseSmtpTransport(app: INestApplication): void {
  app.get<Transporter>(EMAIL_TRANSPORT).close();
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
