import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import { loggerFactory } from './logging.config';
import { MongoDbModule } from './mongodb/mongodb.provider';
import { MONGODB_CONNECTION_NAME } from './mongodb/mongodb.constants';
import { AuditLog, AuditLogSchema } from './audit/audit-log.schema';
import { SystemLog, SystemLogSchema } from './system/system-log.schema';
import { AuditLogRepository } from './audit/audit-log.repository';
import { SystemLogRepository } from './system/system-log.repository';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: loggerFactory
    }),
    MongoDbModule,
    MongooseModule.forFeature(
      [
        { name: AuditLog.name, schema: AuditLogSchema },
        { name: SystemLog.name, schema: SystemLogSchema }
      ],
      MONGODB_CONNECTION_NAME
    )
  ],
  providers: [AuditLogRepository, SystemLogRepository],
  exports: [LoggerModule, AuditLogRepository, SystemLogRepository]
})
export class LoggingModule {}
{
}
