import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  IListSystemLogsUseCase,
  ISystemLogQueryRepository,
  ListSystemLogsQuery,
  PaginatedSystemLogs,
  SYSTEM_LOG_QUERY_REPOSITORY,
  SystemLogQueryFilter
} from '../interfaces/logs.interface';
import { LogMapper } from '../mappers/log.mapper';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class ListSystemLogsUseCase implements IListSystemLogsUseCase {
  constructor(
    @Inject(SYSTEM_LOG_QUERY_REPOSITORY)
    private readonly repository: ISystemLogQueryRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ListSystemLogsUseCase.name);
  }

  async execute(query: ListSystemLogsQuery): Promise<PaginatedSystemLogs> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = query.cursor
      ? LogMapper.decodeSystemCursor(query.cursor)
      : undefined;

    const filter: SystemLogQueryFilter = {
      limit: limit + 1, // fetch one extra to detect next page
      cursor,
      level: query.level,
      event: query.event,
      context: query.context,
      userId: query.userId,
      requestId: query.requestId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };

    const documents = await this.repository.findLogs(filter);

    const hasMore = documents.length > limit;
    const items = documents.slice(0, limit);

    const logs = items.map((doc) => LogMapper.toSystemLogItem(doc));

    const nextCursor =
      hasMore && items.length > 0
        ? LogMapper.encodeSystemCursor(items[items.length - 1])
        : null;

    this.logger.debug(
      {
        limit,
        returned: logs.length,
        hasMore,
        filters: {
          level: query.level,
          event: query.event,
          context: query.context
        }
      },
      'Listed system logs'
    );

    return {
      items: logs,
      nextCursor
    };
  }
}
