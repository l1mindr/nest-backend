import { AppError } from '@core/errors/app.error';
import { ErrorMapper } from '@infrastructure/errors/error-mapper';
import { AuthErrorCode } from '@features/auth/domain/errors/auth-error-code.enum';
import { SessionErrorCode } from '@features/sessions/domain/errors/session-error-code.enum';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { SystemLogEvent } from '@infrastructure/logging/mongodb/mongodb.constants';
import { SystemLogService } from '@infrastructure/logging/system/system-log.service';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

const RETRY_AFTER_HEADER = 'Retry-After';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly systemLogService: SystemLogService
  ) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const error: AppError = ErrorMapper.from(exception);

    this.logError(exception, error, req);
    this.applyRetryAfter(res, error);

    // Persist 5xx errors to MongoDB for operational observability
    if (error.statusCode >= 500) {
      this.systemLogService.error(
        SystemLogEvent.UNHANDLED_EXCEPTION,
        error.message,
        {
          context: GlobalExceptionFilter.name,
          requestId: req.id as string | undefined,
          userId: req.user?.id,
          error: exception instanceof Error ? exception : undefined,
          metadata: {
            statusCode: error.statusCode,
            code: error.code,
            domain: error.domain,
            method: req.method,
            url: req.url
          }
        }
      );
    }

    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        domain: error.domain,
        message: error.message,
        meta: error.metadata ?? {},
        path: req.url,
        timestamp: new Date().toISOString()
      }
    });
  }

  private applyRetryAfter(res: Response, error: AppError) {
    if (error.statusCode !== HttpStatus.TOO_MANY_REQUESTS) return;

    const retryAfter = error.metadata?.retryAfter;

    if (typeof retryAfter === 'number' && retryAfter > 0) {
      res.setHeader(RETRY_AFTER_HEADER, String(retryAfter));
    }
  }

  private logError(exception: unknown, error: AppError, req: Request) {
    const context = {
      correlationId: req.id,
      method: req.method,
      url: req.url,
      statusCode: error.statusCode,
      code: error.code,
      domain: error.domain,
      ip: req.ip,
      userId: req.user?.id,
      sessionId: req.session?.id ?? error.metadata?.sessionId
    };

    if (error.code === AuthErrorCode.PASSWORD_CHANGE_FAILED) {
      this.logger.error(
        { ...context, event: LogEvent.PASSWORD_CHANGE_FAILED, err: exception },
        'Password change failed'
      );
      return;
    }

    if (error.statusCode >= 500) {
      this.logger.error(
        { ...context, event: LogEvent.UNEXPECTED_EXCEPTION, err: exception },
        'Unexpected exception'
      );
      return;
    }

    if (error.code === SessionErrorCode.SESSION_REUSE_DETECTED) {
      this.logger.error(
        { ...context, event: LogEvent.REFRESH_REUSE_DETECTED },
        'Refresh token reuse detected'
      );
      return;
    }

    if (error.statusCode === 429) {
      this.logger.warn(
        { ...context, event: LogEvent.RATE_LIMIT_EXCEEDED },
        'Rate limit exceeded'
      );
      return;
    }

    if (error.statusCode === 401) {
      this.logger.warn(
        { ...context, event: LogEvent.AUTHENTICATION_FAILED },
        'Authentication failed'
      );
      return;
    }

    if (error.statusCode === 403) {
      this.logger.warn(
        { ...context, event: LogEvent.AUTHORIZATION_FAILED },
        'Authorization failed'
      );
    }
  }
}
