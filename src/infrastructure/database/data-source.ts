import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { DataSource } from 'typeorm';

dotenvExpand.expand(dotenv.config());

export default new DataSource({
  type: 'postgres',
  url: process.env.DATA_SOURCE_URL,
  entities: ['dist/features/**/*.entity{.ts,.js}'],
  migrations: ['dist/infrastructure/database/migrations/*{.ts,.js}']
});
