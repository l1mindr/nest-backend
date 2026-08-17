import {
  ActorType,
  AuditAction,
  ResourceType
} from '../mongodb/mongodb.constants';

export interface CreateAuditLogInput {
  userId?: string;
  actorType: ActorType;
  action: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogDocument {
  _id: string;
  timestamp: Date;
  userId?: string;
  actorType: ActorType;
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
