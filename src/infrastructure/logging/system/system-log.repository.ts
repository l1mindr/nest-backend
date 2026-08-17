import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MONGODB_CONNECTION_NAME,
  SystemLogEvent,
  SystemLogLevel
} from '../mongodb/mongodb.constants';
import { SystemLog } from './system-log.schema';
import {
  CreateSystemLogInput,
  SystemLogDocument
} from './system-log.interface';
import { sanitizeMetadata } from '../audit/metadata-sanitizer';

@Injectable()
export class SystemLogRepository {
  private readonly logger = new Logger(SystemLogRepository.name);

  constructor(
    @InjectModel(SystemLog.name, MONGODB_CONNECTION_NAME)
    private readonly systemLogModel: Model<SystemLog>
  ) {}

  /**
   * Creates a system log entry for application observability.
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
   * Finds system logs by level and time range.
   * Intended for future owner dashboard queries and debugging.
   */
  async findByLevel(
    level: SystemLogLevel,
    options: { limit?: number; skip?: number } = {}
  ): Promise<SystemLogDocument[]> {
    const limit = options.limit ?? 100;
    const skip = options.skip ?? 0;

    return this.systemLogModel
      .find({ level })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean<SystemLogDocument[]>()
      .exec();
  }

  /**
   * Finds system logs by request/correlation ID.
   * Useful for tracing all system events within a single request.
   */
  async findByRequestId(requestId: string): Promise<SystemLogDocument[]> {
    return this.systemLogModel
      .find({ requestId })
      .sort({ timestamp: 1 })
      .lean<SystemLogDocument[]>()
      .exec();
  }

  /**
   * Finds system logs by event type.
   */
  async findByEvent(
    event: SystemLogEvent,
    options: { limit?: number; skip?: number } = {}
  ): Promise<SystemLogDocument[]> {
    const limit = options.limit ?? 100;
    const skip = options.skip ?? 0;

    return this.systemLogModel
      .find({ event })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean<SystemLogDocument[]>()
      .exec();
  }
}
