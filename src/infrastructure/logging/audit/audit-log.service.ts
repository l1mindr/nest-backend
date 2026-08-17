import { Injectable } from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '../mongodb/mongodb.constants';
import { AuditLogRepository } from './audit-log.repository';

/**
 * Request-level context available when audit events are triggered from
 * HTTP handlers. All fields are optional: background jobs will not have them.
 */
export interface AuditContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditEventInput {
  action: AuditAction;
  actorType: ActorType;
  userId?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  success: boolean;
  context?: AuditContext;
  /** Safe non-sensitive metadata only — sanitized again before persistence. */
  metadata?: Record<string, unknown>;
}

/**
 * Application-level audit logging service.
 *
 * Callers never interact with the MongoDB layer directly. Every call is
 * fire-and-forget: the business operation always succeeds independently of
 * whether MongoDB is reachable. Errors are reported through the existing
 * application logger (inside the repository) and never propagated.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  record(input: AuditEventInput): void {
    // void: the repository catches all errors internally and logs them via
    // NestJS Logger, so this call can never produce an unhandled rejection.
    this.auditLogRepository
      .create({
        action: input.action,
        actorType: input.actorType,
        userId: input.userId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        success: input.success,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        requestId: input.context?.requestId,
        metadata: input.metadata
      })
      .catch(() => undefined);
  }
}
