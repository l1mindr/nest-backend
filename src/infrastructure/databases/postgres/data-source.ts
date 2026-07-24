import postgresConfig from '@infrastructure/config/databases/postgres.config';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { DataSource } from 'typeorm';

dotenvExpand.expand(dotenv.config());

const config = postgresConfig();

export default new DataSource({
  type: 'postgres',
  url: config.url,
  synchronize: false,
  migrationsRun: false,
  poolSize: config.poolSize,
  connectTimeoutMS: config.connectTimeoutMS,
  extra: config.extra,
  entities: ['dist/features/**/*.entity{.ts,.js}'],
  migrations: ['dist/infrastructure/databases/postgres/migrations/*{.ts,.js}']
});
