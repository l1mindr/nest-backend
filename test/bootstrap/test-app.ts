import { HttpExceptionFilter } from '@core/common/filters/http-exception.filter';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

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
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const dataSource = app.get(DataSource);
  await dataSource.runMigrations();
  return { app, dataSource };
}
