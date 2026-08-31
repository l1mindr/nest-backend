/**
 * Bootstraps the initial OWNER account.
 *
 * An explicit, auditable, backend-only command — it is the single supported way
 * to create the system Owner. It is idempotent: once an Owner exists it makes
 * no changes and reports so.
 *
 * The Owner password is hashed with the exact same mechanism normal users get
 * (Argon2id, via `HashingProvider`/`Argon2Provider`) and is never logged or
 * printed. Credentials come from environment configuration only and are never
 * hardcoded.
 *
 * Usage: pnpm seed:owner
 */
import 'reflect-metadata';
import 'tsconfig-paths/register';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { DataSource, Repository } from 'typeorm';
import { Argon2Provider } from '../src/features/auth/infrastructure/providers/argon2.provider';
import { HashingProvider } from '../src/features/auth/infrastructure/providers/hashing.provider';
import { User } from '../src/features/users/domain/entities/user.entity';
import { Session } from '../src/features/sessions/domain/entities/session.entity';
import { UserRole } from '../src/features/users/domain/enums/user-role.enum';
import { UserStatus } from '../src/features/users/domain/enums/user-status.enum';
import postgresConfig from '../src/infrastructure/config/databases/postgres.config';
import { ENV_VALIDATION_SCHEMA } from '../src/infrastructure/config/env/env.schema';
import { NODE_ENV } from '../src/infrastructure/config/env/env.constants';

const LOG_PREFIX = '[seed-owner]';

function fail(message: string): never {
  console.error(`${LOG_PREFIX} ✖ ${message}`);
  process.exit(1);
}

function info(message: string): void {
  console.log(`${LOG_PREFIX} ℹ ${message}`);
}

function ok(message: string): void {
  console.log(`${LOG_PREFIX} ✔ ${message}`);
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validationSchema: ENV_VALIDATION_SCHEMA,
      envFilePath: [`.env.${NODE_ENV}`, '.env']
    }),
    // Only the pieces the bootstrap needs — Postgres and the password hasher.
    // Redis, Mongo and the email queue stay out of this path.
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          (process.env.LOG_LEVEL as 'info' | 'warn' | 'error' | 'silent') ??
          'warn',
        autoLogging: false,
        quietReqLogger: true,
        redact: { paths: [], censor: '[REDACTED]' },
        ...(process.env.NODE_ENV === 'production'
          ? {}
          : {
              transport: {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname'
                }
              }
            })
      }
    }),
    TypeOrmModule.forFeature([User, Session]),
    TypeOrmModule.forRootAsync(postgresConfig.asProvider())
  ],
  providers: [{ provide: HashingProvider, useClass: Argon2Provider }]
})
class SeedOwnerModule {}

export interface SeedOwnerDeps {
  dataSource: DataSource;
  hashingProvider: HashingProvider;
}

async function collectDeps(): Promise<SeedOwnerDeps> {
  const app = await NestFactory.createApplicationContext(SeedOwnerModule, {
    logger: false,
    abortOnError: false,
    autoFlushLogs: false
  });

  return {
    dataSource: app.get(DataSource),
    hashingProvider: app.get(HashingProvider)
  };
}

export interface OwnerBootstrapOutcome {
  created: boolean;
  email: string;
}

export async function bootstrapOwner(
  deps: SeedOwnerDeps,
  email: string,
  password: string
): Promise<OwnerBootstrapOutcome> {
  const userRepository: Repository<User> = deps.dataSource.getRepository(User);

  const existing = await userRepository.findOne({
    where: { role: UserRole.OWNER },
    select: { id: true, email: true, role: true }
  });

  if (existing) {
    return { created: false, email: existing.email };
  }

  const passwordHash = await deps.hashingProvider.hash(password);

  // A single atomic insert. The OWNER role is protected at the database level
  // by the partial unique index `uq_user_single_owner` (`user(role) WHERE
  // role='OWNER'`), so a concurrent bootstrap can never create a second Owner —
  // the second insert is rejected, and this run reports as already-existing.
  try {
    await userRepository.save(
      userRepository.create({
        email,
        username: email.split('@')[0] ?? email,
        password: passwordHash,
        name: null,
        role: UserRole.OWNER,
        status: UserStatus.ACTIVATE
      })
    );
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return { created: false, email };
    }
    throw error;
  }

  return { created: true, email };
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  // 23505 = unique_violation in PostgreSQL.
  return code === '23505';
}

async function main(): Promise<void> {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;

  if (!email) {
    fail('OWNER_EMAIL is missing');
  }
  if (!password) {
    fail('OWNER_PASSWORD is missing');
  }

  let deps: SeedOwnerDeps;
  try {
    deps = await collectDeps();
  } catch (error: unknown) {
    fail(
      `could not connect to the database: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  try {
    const outcome = await bootstrapOwner(
      deps,
      email as string,
      password as string
    );

    if (outcome.created) {
      ok('Owner created successfully');
      ok(`Email: ${outcome.email}`);
    } else {
      info('Owner already exists');
      info('No changes made.');
      info(`Email: ${outcome.email}`);
    }
  } finally {
    await deps.dataSource.destroy();
  }
}

// Runs only when invoked directly (`pnpm seed:owner`), not when the module is
// imported by a test that drives `bootstrapOwner` directly.
const isDirectRun =
  typeof require !== 'undefined' &&
  require.main !== undefined &&
  require.main === module;

if (isDirectRun) {
  main().catch((error: unknown) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
