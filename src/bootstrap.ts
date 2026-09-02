import {
  IS_DEVELOPMENT,
  IS_PRODUCTION,
  IS_TEST
} from '@infrastructure/config/env/env.constants';
import { helmetConfig } from '@infrastructure/http/helmet.config';
import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import {
  buildOpenApiDocument,
  setupOpenApiUi
} from '@presentation/swagger/openapi.document';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { ServerOptions } from 'socket.io';

/**
 * Applies the same CORS allowlist to the WebSocket (Socket.IO) handshake as
 * `app.enableCors` applies to REST — computed at `setupApp` runtime rather
 * than at `@WebSocketGateway()` decorator/module-load time, since the
 * decorator would otherwise read `process.env.CORS_ORIGIN` before
 * `ConfigModule` has necessarily loaded it.
 */
class CorsAwareSocketIoAdapter extends IoAdapter {
  constructor(
    app: NestExpressApplication,
    private readonly corsOrigin: string | false
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigin, credentials: true }
    });
  }
}

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

  // Cross-origin shipping relies on credentials (cookies), because authentication
  // relies on HttpOnly cookies.
  //
  // The development fallback is the Next.js frontend origin (http://localhost:3000),
  // not the legacy Astro/Vite port (4321). Cookies are host-only and cross-origin
  // for the browser, so the refresh response's `Set-Cookie` for the new
  // `access_token` is only honored when this origin is in the CORS allowlist with
  // credentials enabled — otherwise the browser discards it and an expired access
  // token can never be refreshed despite a valid refresh_token cookie.
  const corsOrigin: string | false =
    process.env.CORS_ORIGIN ??
    (IS_DEVELOPMENT ? 'http://localhost:3000' : false);

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    // X-CSRF-Token is required by the double-submit CSRF guard on every unsafe
    // request (see CsrfGuard); a cross-origin browser cannot send it unless it
    // is listed here. Headers are matched case-insensitively by the CORS
    // middleware, so the client may send either casing.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
  });

  // Socket.IO attaches to this same underlying HTTP server (no separate
  // port/origin) but enforces its own CORS check on the handshake, so it
  // needs the identical allowlist explicitly.
  app.useWebSocketAdapter(new CorsAwareSocketIoAdapter(app, corsOrigin));

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
