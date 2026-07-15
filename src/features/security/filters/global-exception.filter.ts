import { AppError } from '@core/errors/app.error';
import { ErrorMapper } from '@core/errors/error-mapper';
import { SessionErrorCode } from '@features/sessions/errors/session-error-code.enum';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const error: AppError = ErrorMapper.from(exception);

    this.logError(exception, error, req);

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
