import {
  IS_DEVELOPMENT,
  IS_PRODUCTION,
  IS_TEST
} from '@infrastructure/config/env/env.constants';
import { helmetConfig } from '@infrastructure/http/helmet.config';
import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  buildOpenApiDocument,
  setupOpenApiUi
} from '@presentation/swagger/openapi.document';
import compression from 'compression';
import cookieParser from 'cookie-parser';

/**
 * Servers advertised in the OpenAPI document. The public entry is only listed
 * when the deployment declares one, so generated clients never point at a
 * host that does not exist.
 */
function openApiServers() {
  const servers = [
    { url: 'http://localhost:8080', description: 'Local development' }
  ];

  if (process.env.PUBLIC_API_URL) {
    servers.unshift({
      url: process.env.PUBLIC_API_URL,
      description: 'Public deployment'
    });
  }

  return servers;
}

export async function setupApp(app: NestExpressApplication) {
  if (IS_PRODUCTION || IS_TEST) {
    app.set('trust proxy', 1);
  }

  // because authentication relies on HttpOnly cookies.
  const corsOrigin: string | false =
    process.env.CORS_ORIGIN ??
    (IS_DEVELOPMENT ? 'http://localhost:4321' : false);

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  if (IS_DEVELOPMENT) {
    setupOpenApiUi(
      app,
      buildOpenApiDocument(app, { servers: openApiServers() })
    );
  }

  app.use(helmetConfig);

  app.use(
    compression({
      level: 6,
      filter: (req) =>
        req.headers['accept-encoding']?.includes('gzip') ?? false,
      threshold: 1024
    })
  );

  app.enableVersioning({
    type: VersioningType.URI
  });

  app.use(cookieParser());
}
