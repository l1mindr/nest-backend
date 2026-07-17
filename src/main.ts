import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupApp } from './bootstrap';
import { LogEvent } from './infrastructure/logging/logging.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  setupApp(app);
  app.enableShutdownHooks();
  await app.listen(8080);

  logger.log(
    {
      event: LogEvent.APPLICATION_STARTUP,
      port: 8080,
      environment: process.env.NODE_ENV
    },
    'Application started'
  );
}

bootstrap();
