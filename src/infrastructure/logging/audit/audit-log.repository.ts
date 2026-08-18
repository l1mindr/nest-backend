import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MONGODB_CONNECTION_NAME } from '../mongodb/mongodb.constants';
import { AuditLog } from './audit-log.schema';
import { AuditLogDocument, CreateAuditLogInput } from './audit-log.interface';
import { sanitizeMetadata } from './metadata-sanitizer';
import {
  AuditLogQueryFilter,
  IAuditLogQueryRepository
} from '../../../features/logs/application/interfaces/logs.interface';

@Injectable()
export class AuditLogRepository implements IAuditLogQueryRepository {
  private readonly logger = new Logger(AuditLogRepository.name);

  constructor(
    @InjectModel(AuditLog.name, MONGODB_CONNECTION_NAME)
    private readonly auditLogModel: Model<AuditLog>
  ) {}

  /**
   * Creates an audit log entry. Append-only operation.
   * Metadata is sanitized to remove sensitive information before persistence.
   *
   * Logging failure must NOT break the business operation. Errors are logged
   * but not rethrown.
   */
  async create(input: CreateAuditLogInput): Promise<void> {
    try {
      const sanitizedMetadata = sanitizeMetadata(input.metadata);

      const auditLog = new this.auditLogModel({
        timestamp: new Date(),
        userId: input.userId,
        actorType: input.actorType,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        success: input.success,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: sanitizedMetadata,
        createdAt: new Date()
      });

      await auditLog.save();
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          action: input.action,
          userId: input.userId,
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
   * Returns limit + 1 documents so the use-case can tell whether a next page
   * exists without a separate count query.
   */
  async findLogs(filter: AuditLogQueryFilter): Promise<AuditLogDocument[]> {
    const query: Record<string, any> = {};

    if (filter.userId) query.userId = filter.userId;
    if (filter.action) query.action = filter.action;
    if (filter.resourceType) query.resourceType = filter.resourceType;
    if (filter.resourceId) query.resourceId = filter.resourceId;
    if (filter.actorType) query.actorType = filter.actorType;
    if (filter.success !== undefined) query.success = filter.success;
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

    return this.auditLogModel
      .find(query)
      .sort({ timestamp: -1, _id: -1 })
      .limit(filter.limit)
      .lean<AuditLogDocument[]>()
      .exec();
  }

  /**
   * Finds audit logs by user ID.
   * @deprecated Use findLogs() with a userId filter for the owner query API.
   */
  async findByUserId(
    userId: string,
    options: { limit?: number; skip?: number } = {}
  ): Promise<AuditLogDocument[]> {
    const limit = options.limit ?? 50;
    const skip = options.skip ?? 0;

    return this.auditLogModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean<AuditLogDocument[]>()
      .exec();
  }

  /**
   * Finds audit logs by request/correlation ID.
   */
  async findByRequestId(requestId: string): Promise<AuditLogDocument[]> {
    return this.auditLogModel
      .find({ requestId })
      .sort({ timestamp: 1 })
      .lean<AuditLogDocument[]>()
      .exec();
  }
}
