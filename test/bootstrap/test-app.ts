import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/bootstrap';
import { runMigrations } from '../helpers/database.helper';

export interface ITextContext {
  app: INestApplication;
  dataSource: DataSource;
}

export async function createTestApp(): Promise<ITextContext> {
  process.env.NODE_ENV = 'test';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleFixture.createNestApplication();
  setupApp(app);
  await app.init();

  const dataSource = app.get(DataSource);

  await runMigrations(dataSource);
  return { app, dataSource };
}
