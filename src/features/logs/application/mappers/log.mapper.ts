import {
  AuditLogCursor,
  AuditLogItem,
  SystemLogCursor,
  SystemLogItem
} from '../interfaces/logs.interface';
import { AuditLogDocument } from '@infrastructure/logging/audit/audit-log.interface';
import { SystemLogDocument } from '@infrastructure/logging/system/system-log.interface';

export class LogMapper {
  static toAuditLogItem(doc: AuditLogDocument): AuditLogItem {
    return {
      id: doc._id.toString(),
      timestamp: doc.timestamp,
      actorType: doc.actorType,
      userId: doc.userId,
      action: doc.action,
      resourceType: doc.resourceType,
      resourceId: doc.resourceId,
      success: doc.success,
      ipAddress: doc.ipAddress,
      userAgent: doc.userAgent,
      requestId: doc.requestId,
      metadata: doc.metadata,
      createdAt: doc.createdAt
    };
  }

  static toSystemLogItem(doc: SystemLogDocument): SystemLogItem {
    return {
      id: doc._id.toString(),
      timestamp: doc.timestamp,
      level: doc.level,
      event: doc.event,
      message: doc.message,
      context: doc.context,
      userId: doc.userId,
      requestId: doc.requestId,
      metadata: doc.metadata,
      error: doc.error,
      durationMs: doc.durationMs,
      createdAt: doc.createdAt
    };
  }

  static encodeAuditCursor(doc: AuditLogDocument): string {
    const cursor: AuditLogCursor = {
      timestamp: doc.timestamp.toISOString(),
      _id: doc._id.toString()
    };
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  static decodeAuditCursor(encoded: string): AuditLogCursor {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }

  static encodeSystemCursor(doc: SystemLogDocument): string {
    const cursor: SystemLogCursor = {
      timestamp: doc.timestamp.toISOString(),
      _id: doc._id.toString()
    };
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  static decodeSystemCursor(encoded: string): SystemLogCursor {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }
}
