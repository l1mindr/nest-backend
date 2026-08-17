import { SystemLogEvent, SystemLogLevel } from '../mongodb/mongodb.constants';

export interface CreateSystemLogInput {
  level: SystemLogLevel;
  event: SystemLogEvent;
  message: string;
  context?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  durationMs?: number;
}

export interface SystemLogDocument {
  _id: string;
  timestamp: Date;
  level: SystemLogLevel;
  event: SystemLogEvent;
  message: string;
  context?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  durationMs?: number;
  createdAt: Date;
}
