import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { Params } from 'nestjs-pino';
import { REDACT_PATHS } from './logging.constants';

const VALID_LOG_LEVELS = ['info', 'debug', 'warn', 'error', 'silent'] as const;

type ValidLogLevel = (typeof VALID_LOG_LEVELS)[number];

function isValidLogLevel(value: string): value is ValidLogLevel {
  return (VALID_LOG_LEVELS as readonly string[]).includes(value);
}

interface LoggingEnvironment {
  nodeEnv: string | undefined;
  ci: string | undefined;
  logLevel: string | undefined;
  e2eLogs: string | undefined;
}

function resolveLogLevel(env: LoggingEnvironment): ValidLogLevel {
  if (env.logLevel && isValidLogLevel(env.logLevel)) {
    return env.logLevel;
  }

  if (env.ci === 'true' || env.nodeEnv === 'test') {
    return 'error';
  }

  if (env.nodeEnv === 'production') {
    return 'warn';
  }

  return 'debug';
}

function resolveAutoLogging(
  level: ValidLogLevel,
  env: LoggingEnvironment
): boolean {
  if (level === 'silent') {
    return false;
  }

  if (env.e2eLogs === 'true') {
    return true;
  }

  if (env.ci === 'true' || env.nodeEnv === 'test') {
    return false;
  }

  if (env.nodeEnv === 'production') {
    return false;
  }

  return true;
}

export function loggerFactory(config: ConfigService): Params {
  const env: LoggingEnvironment = {
    nodeEnv: config.get<string>('NODE_ENV'),
    ci: config.get<string>('CI'),
    logLevel: config.get<string>('LOG_LEVEL'),
    e2eLogs: config.get<string>('E2E_LOGS')
  };

  const isProduction = env.nodeEnv === 'production';

  const level = resolveLogLevel(env);
  const autoLogging = resolveAutoLogging(level, env);

  return {
    pinoHttp: {
      level,
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

      customProps: (req: IncomingMessage) => {
        const expressReq = req as Request;
        return {
          correlationId: expressReq.id,
          ip: expressReq.ip,
          userId: expressReq.user?.id,
          sessionId: expressReq.session?.id
        };
      },

      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },

      customSuccessMessage: (req: IncomingMessage, res: ServerResponse) =>
        `${req.method} ${(req as Request).originalUrl ?? req.url} ${res.statusCode}`,
      customErrorMessage: (req: IncomingMessage, res: ServerResponse) =>
        `${req.method} ${(req as Request).originalUrl ?? req.url} ${res.statusCode}`,

      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]'
      },

      autoLogging,
      quietReqLogger: true
    }
  };
}
