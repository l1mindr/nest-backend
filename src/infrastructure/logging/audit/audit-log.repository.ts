import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MONGODB_CONNECTION_NAME } from '../mongodb/mongodb.constants';
import { AuditLog } from './audit-log.schema';
import { AuditLogDocument, CreateAuditLogInput } from './audit-log.interface';
import { sanitizeMetadata } from './metadata-sanitizer';

@Injectable()
export class AuditLogRepository {
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
   * Finds audit logs by user ID.
   * Intended for future owner dashboard queries.
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
   * Useful for tracing all audit events within a single request.
   */
  async findByRequestId(requestId: string): Promise<AuditLogDocument[]> {
    return this.auditLogModel
      .find({ requestId })
      .sort({ timestamp: 1 })
      .lean<AuditLogDocument[]>()
      .exec();
  }
}
