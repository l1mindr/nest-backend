import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const DEFAULT_POOL_SIZE = 10;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export default registerAs('database', () => {
  const poolSize = intEnv('DATA_SOURCE_POOL_SIZE', DEFAULT_POOL_SIZE);
  const connectTimeoutMS = intEnv(
    'DATA_SOURCE_CONNECT_TIMEOUT_MS',
    DEFAULT_CONNECT_TIMEOUT_MS
  );
  const idleTimeoutMs = intEnv(
    'DATA_SOURCE_IDLE_TIMEOUT_MS',
    DEFAULT_IDLE_TIMEOUT_MS
  );

  const config = {
    type: 'postgres',
    autoLoadEntities: true,
    url: `postgresql://${process.env.DATA_SOURCE_USERNAME}:${process.env.DATA_SOURCE_PASSWORD}@${process.env.DATA_SOURCE_HOST}:${process.env.DATA_SOURCE_PORT}/${process.env.DATA_SOURCE_DATABASE}`,
    poolSize,
    connectTimeoutMS,
    extra: {
      idleTimeoutMillis: idleTimeoutMs,
      application_name: process.env.SERVICE_NAME ?? 'nest-backend'
    }
  } as const satisfies TypeOrmModuleOptions;

  return config;
});
