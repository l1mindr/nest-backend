import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { Params } from 'nestjs-pino';
import { REDACT_PATHS } from './logging.constants';

export function loggerFactory(config: ConfigService): Params {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const isTest = config.get<string>('NODE_ENV') === 'test';

  return {
    pinoHttp: {
      level: isProduction ? 'info' : isTest ? 'warn' : 'debug',
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname'
            }
          },

      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const inbound = req.headers['x-request-id'];
        const id =
          (Array.isArray(inbound) ? inbound[0] : inbound) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },

      customProps: (req: any) => ({
        correlationId: req.id,
        ip: req.ip,
        userId: req.user?.id,
        sessionId: req.session?.id
      }),

      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },

      customSuccessMessage: (req: any, res: any) =>
        `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode}`,
      customErrorMessage: (req: any, res: any) =>
        `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode}`,

      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]'
      },

      autoLogging: !isTest,
      quietReqLogger: true
    }
  };
}
