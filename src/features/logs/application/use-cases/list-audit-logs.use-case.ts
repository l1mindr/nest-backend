import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  AUDIT_LOG_QUERY_REPOSITORY,
  AuditLogQueryFilter,
  IAuditLogQueryRepository,
  IListAuditLogsUseCase,
  ListAuditLogsQuery,
  PaginatedAuditLogs
} from '../interfaces/logs.interface';
import { LogMapper } from '../mappers/log.mapper';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class ListAuditLogsUseCase implements IListAuditLogsUseCase {
  constructor(
    @Inject(AUDIT_LOG_QUERY_REPOSITORY)
    private readonly repository: IAuditLogQueryRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ListAuditLogsUseCase.name);
  }

  async execute(query: ListAuditLogsQuery): Promise<PaginatedAuditLogs> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = query.cursor
      ? LogMapper.decodeAuditCursor(query.cursor)
      : undefined;

    const filter: AuditLogQueryFilter = {
      limit: limit + 1, // fetch one extra to detect next page
      cursor,
      userId: query.userId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      actorType: query.actorType,
      success: query.success,
      requestId: query.requestId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };

    const documents = await this.repository.findLogs(filter);

    const hasMore = documents.length > limit;
    const items = documents.slice(0, limit);

    const logs = items.map((doc) => LogMapper.toAuditLogItem(doc));

    const nextCursor =
      hasMore && items.length > 0
        ? LogMapper.encodeAuditCursor(items[items.length - 1])
        : null;

    this.logger.debug(
      {
        limit,
        returned: logs.length,
        hasMore,
        filters: {
          userId: query.userId,
          action: query.action,
          resourceType: query.resourceType,
          success: query.success
        }
      },
      'Listed audit logs'
    );

    return {
      items: logs,
      nextCursor
    };
  }
}
