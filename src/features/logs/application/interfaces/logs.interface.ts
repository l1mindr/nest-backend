import { PaginatedResult } from '@core/pagination/paginated-result.interface';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '../../domain/enums/audit.enum';
import { SystemLogEvent, SystemLogLevel } from '../../domain/enums/system.enum';
import { AuditLogDocument } from '@infrastructure/logging/audit/audit-log.interface';
import { SystemLogDocument } from '@infrastructure/logging/system/system-log.interface';

export type { PaginatedResult };

// ------------------------------------------------------------------ Cursors

export interface AuditLogCursor {
  timestamp: string;
  _id: string;
}

export interface SystemLogCursor {
  timestamp: string;
  _id: string;
}

// ------------------------------------------------------------------ Repository filter shapes

export interface AuditLogQueryFilter {
  userId?: string;
  action?: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  actorType?: ActorType;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  requestId?: string;
  cursor?: AuditLogCursor;
  limit: number;
}

export interface SystemLogQueryFilter {
  level?: SystemLogLevel;
  event?: SystemLogEvent;
  context?: string;
  startDate?: Date;
  endDate?: Date;
  requestId?: string;
  userId?: string;
  cursor?: SystemLogCursor;
  limit: number;
}

// ------------------------------------------------------------------ Repository extension

export interface IAuditLogQueryRepository {
  findLogs(filter: AuditLogQueryFilter): Promise<AuditLogDocument[]>;
}

export interface ISystemLogQueryRepository {
  findLogs(filter: SystemLogQueryFilter): Promise<SystemLogDocument[]>;
}

// ------------------------------------------------------------------ Use-case query input shapes

export interface ListAuditLogsQuery {
  cursor?: string;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  actorType?: ActorType;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  requestId?: string;
}

export interface ListSystemLogsQuery {
  cursor?: string;
  limit?: number;
  level?: SystemLogLevel;
  event?: SystemLogEvent;
  context?: string;
  startDate?: string;
  endDate?: string;
  requestId?: string;
  userId?: string;
}

// ------------------------------------------------------------------ Use-case response shapes

export interface AuditLogItem {
  id: string;
  timestamp: Date;
  actorType: ActorType;
  userId?: string;
  action: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface SystemLogErrorItem {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

export interface SystemLogItem {
  id: string;
  timestamp: Date;
  level: SystemLogLevel;
  event: SystemLogEvent;
  message: string;
  context?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: SystemLogErrorItem;
  durationMs?: number;
  createdAt: Date;
}

export interface PaginatedAuditLogs {
  items: AuditLogItem[];
  nextCursor: string | null;
}

export interface PaginatedSystemLogs {
  items: SystemLogItem[];
  nextCursor: string | null;
}

// ------------------------------------------------------------------ Use-case symbols & interfaces

export const AUDIT_LOG_QUERY_REPOSITORY = Symbol('IAuditLogQueryRepository');
export const SYSTEM_LOG_QUERY_REPOSITORY = Symbol('ISystemLogQueryRepository');

export const LIST_AUDIT_LOGS_USE_CASE = Symbol('IListAuditLogsUseCase');
export interface IListAuditLogsUseCase {
  execute(query: ListAuditLogsQuery): Promise<PaginatedAuditLogs>;
}

export const LIST_SYSTEM_LOGS_USE_CASE = Symbol('IListSystemLogsUseCase');
export interface IListSystemLogsUseCase {
  execute(query: ListSystemLogsQuery): Promise<PaginatedSystemLogs>;
}
