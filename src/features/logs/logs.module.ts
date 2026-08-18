import { Module } from '@nestjs/common';
import { LogsController } from './presentation/controllers/logs.controller';
import { ListAuditLogsUseCase } from './application/use-cases/list-audit-logs.use-case';
import { ListSystemLogsUseCase } from './application/use-cases/list-system-logs.use-case';
import { LogMapper } from './application/mappers/log.mapper';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { AuditLogRepository } from '@infrastructure/logging/audit/audit-log.repository';
import { SystemLogRepository } from '@infrastructure/logging/system/system-log.repository';
import {
  AUDIT_LOG_QUERY_REPOSITORY,
  LIST_AUDIT_LOGS_USE_CASE,
  LIST_SYSTEM_LOGS_USE_CASE,
  SYSTEM_LOG_QUERY_REPOSITORY
} from './application/interfaces/logs.interface';

@Module({
  imports: [LoggingModule],
  controllers: [LogsController],
  providers: [
    LogMapper,
    {
      provide: AUDIT_LOG_QUERY_REPOSITORY,
      useExisting: AuditLogRepository
    },
    {
      provide: SYSTEM_LOG_QUERY_REPOSITORY,
      useExisting: SystemLogRepository
    },
    {
      provide: LIST_AUDIT_LOGS_USE_CASE,
      useClass: ListAuditLogsUseCase
    },
    {
      provide: LIST_SYSTEM_LOGS_USE_CASE,
      useClass: ListSystemLogsUseCase
    }
  ]
})
export class LogsModule {}
