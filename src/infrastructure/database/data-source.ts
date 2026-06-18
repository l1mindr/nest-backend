import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { DataSource } from 'typeorm';
import databaseConfig from './config/database.config';

dotenvExpand.expand(dotenv.config());

const config = databaseConfig();

export default new DataSource({
  type: 'postgres',
  url: config.url,
  entities: ['dist/features/**/*.entity{.ts,.js}'],
  migrations: ['dist/infrastructure/database/migrations/*{.ts,.js}']
});
