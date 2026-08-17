import { Injectable } from '@nestjs/common';
import { SystemLogEvent, SystemLogLevel } from '../mongodb/mongodb.constants';
import { SystemLogRepository } from './system-log.repository';

export interface SystemLogContext {
  context?: string;
  userId?: string;
  requestId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

/**
 * Application-level system logging service.
 *
 * Wraps the MongoDB system-log repository with a simple API that matches the
 * existing pino log-level idiom. Every call is fire-and-forget: errors are
 * reported through NestJS Logger (inside the repository) and never propagated
 * to the caller.
 */
@Injectable()
export class SystemLogService {
  constructor(private readonly systemLogRepository: SystemLogRepository) {}

  error(
    event: SystemLogEvent,
    message: string,
    opts: SystemLogContext = {}
  ): void {
    this.systemLogRepository
      .create({
        level: SystemLogLevel.ERROR,
        event,
        message,
        context: opts.context,
        userId: opts.userId,
        requestId: opts.requestId,
        durationMs: opts.durationMs,
        metadata: opts.metadata,
        error: this.extractError(opts.error)
      })
      .catch(() => undefined);
  }

  warn(
    event: SystemLogEvent,
    message: string,
    opts: SystemLogContext = {}
  ): void {
    this.systemLogRepository
      .create({
        level: SystemLogLevel.WARNING,
        event,
        message,
        context: opts.context,
        userId: opts.userId,
        requestId: opts.requestId,
        durationMs: opts.durationMs,
        metadata: opts.metadata,
        error: this.extractError(opts.error)
      })
      .catch(() => undefined);
  }

  info(
    event: SystemLogEvent,
    message: string,
    opts: SystemLogContext = {}
  ): void {
    this.systemLogRepository
      .create({
        level: SystemLogLevel.INFO,
        event,
        message,
        context: opts.context,
        userId: opts.userId,
        requestId: opts.requestId,
        durationMs: opts.durationMs,
        metadata: opts.metadata
      })
      .catch(() => undefined);
  }

  private extractError(
    error?: unknown
  ): { name: string; message: string; stack?: string } | undefined {
    if (error === undefined || error === null) return undefined;
    if (error instanceof Error) {
      return { name: error.name, message: error.message, stack: error.stack };
    }
    return { name: 'UnknownError', message: String(error) };
  }
}
