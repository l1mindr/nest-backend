import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { loggerFactory } from './logging.config';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: loggerFactory
    })
  ],
  exports: [LoggerModule]
})
export class LoggingModule {}
