import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupApp } from './bootstrap';
import { LogEvent } from './infrastructure/logging/logging.constants';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let app: NestExpressApplication;
let logger: Logger;

function logFatal(error: Error, message: string) {
  if (logger) {
    logger.error(
      {
        event: LogEvent.UNEXPECTED_EXCEPTION,
        err: error,
        environment: process.env.NODE_ENV
      },
      message
    );
  } else {
    console.error(`[FATAL] ${message}`, error);
  }
}

function gracefulShutdown(error: Error, message: string) {
  logFatal(error, message);

  const forceExit = setTimeout(() => {
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  app
    ?.close()
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
}

async function bootstrap() {
  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true
  });

  logger = app.get(Logger);
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

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  gracefulShutdown(
    error,
    'Unhandled rejection detected, initiating graceful shutdown'
  );
});

process.on('uncaughtException', (error) => {
  gracefulShutdown(
    error,
    'Uncaught exception detected, initiating graceful shutdown'
  );
});

bootstrap().catch((error) => {
  logFatal(error as Error, 'Application failed to start');
  process.exit(1);
});
