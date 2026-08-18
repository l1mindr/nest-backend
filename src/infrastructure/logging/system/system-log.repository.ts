import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MONGODB_CONNECTION_NAME } from '../mongodb/mongodb.constants';
import { SystemLog } from './system-log.schema';
import {
  CreateSystemLogInput,
  SystemLogDocument
} from './system-log.interface';
import { sanitizeMetadata } from '../audit/metadata-sanitizer';
import {
  ISystemLogQueryRepository,
  SystemLogQueryFilter
} from '../../../features/logs/application/interfaces/logs.interface';

@Injectable()
export class SystemLogRepository implements ISystemLogQueryRepository {
  private readonly logger = new Logger(SystemLogRepository.name);

  constructor(
    @InjectModel(SystemLog.name, MONGODB_CONNECTION_NAME)
    private readonly systemLogModel: Model<SystemLog>
  ) {}

  /**
   * Creates a system log entry.
   * Metadata is sanitized to remove sensitive information before persistence.
   *
   * Logging failure must NOT break the business operation. Errors are logged
   * but not rethrown.
   */
  async create(input: CreateSystemLogInput): Promise<void> {
    try {
      const sanitizedMetadata = sanitizeMetadata(input.metadata);

      const systemLog = new this.systemLogModel({
        timestamp: new Date(),
        level: input.level,
        event: input.event,
        message: input.message,
        context: input.context,
        userId: input.userId,
        requestId: input.requestId,
        metadata: sanitizedMetadata,
        error: input.error,
        durationMs: input.durationMs,
        createdAt: new Date()
      });

      await systemLog.save();
    } catch (error) {
      this.logger.error(
        `Failed to create system log: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          event: input.event,
          level: input.level,
          error: error instanceof Error ? error.stack : undefined
        }
      );
    }
  }

  /**
   * Paginated query for the owner log API.
   *
   * Cursor is on (timestamp DESC, _id DESC): a document qualifies if its
   * timestamp is strictly older than the cursor's, or if the timestamps are
   * equal and its _id is lexicographically smaller.
   *
   * Returns limit documents so the use-case can tell whether a next page
   * exists without a separate count query.
   */
  async findLogs(filter: SystemLogQueryFilter): Promise<SystemLogDocument[]> {
    const query: Record<string, any> = {};

    if (filter.level) query.level = filter.level;
    if (filter.event) query.event = filter.event;
    if (filter.context) query.context = filter.context;
    if (filter.userId) query.userId = filter.userId;
    if (filter.requestId) query.requestId = filter.requestId;

    if (filter.startDate || filter.endDate) {
      query.timestamp = {};
      if (filter.startDate) query.timestamp.$gte = filter.startDate;
      if (filter.endDate) query.timestamp.$lte = filter.endDate;
    }

    if (filter.cursor) {
      const { timestamp, _id } = filter.cursor;
      const cursorTs = new Date(timestamp);

      const cursorCondition = {
        $or: [
          { timestamp: { $lt: cursorTs } },
          { timestamp: cursorTs, _id: { $lt: _id } }
        ]
      };

      if (query.$or) {
        query.$and = [{ $or: query.$or }, cursorCondition];
        delete query.$or;
      } else {
        Object.assign(query, cursorCondition);
      }
    }

    return this.systemLogModel
      .find(query)
      .sort({ timestamp: -1, _id: -1 })
      .limit(filter.limit)
      .lean<SystemLogDocument[]>()
      .exec();
  }

  /**
   * Finds system logs by level.
   * @deprecated Use findLogs() with a level filter for the owner query API.
   */
  async findByLevel(
    level: string,
    options: { limit?: number; skip?: number } = {}
  ): Promise<SystemLogDocument[]> {
    const limit = options.limit ?? 100;
    const skip = options.skip ?? 0;

    return this.systemLogModel
      .find({ level } as any)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean<SystemLogDocument[]>()
      .exec();
  }

  /**
   * Finds system logs by request/correlation ID.
   */
  async findByRequestId(requestId: string): Promise<SystemLogDocument[]> {
    return this.systemLogModel
      .find({ requestId } as any)
      .sort({ timestamp: 1 })
      .lean<SystemLogDocument[]>()
      .exec();
  }

  /**
   * Finds system logs by event.
   * @deprecated Use findLogs() with an event filter for the owner query API.
   */
  async findByEvent(
    event: string,
    options: { limit?: number; skip?: number } = {}
  ): Promise<SystemLogDocument[]> {
    const limit = options.limit ?? 100;
    const skip = options.skip ?? 0;

    return this.systemLogModel
      .find({ event } as any)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean<SystemLogDocument[]>()
      .exec();
  }
}
