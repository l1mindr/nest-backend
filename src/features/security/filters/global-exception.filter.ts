import { AppError } from '@features/security/errors/app.error';
import { ErrorMapper } from '@features/security/errors/error-mapper';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const error: AppError = ErrorMapper.from(exception);

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
}
