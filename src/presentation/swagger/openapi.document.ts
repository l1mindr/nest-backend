import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import {
  ApiTagName,
  AuthCookie,
  CSRF_HEADER,
  SecurityScheme
} from './openapi.constants';

export interface OpenApiServer {
  url: string;
  description: string;
}

export interface OpenApiOptions {
  /** Ordered from the most local to the most public deployment. */
  servers: OpenApiServer[];
}

/** Route the Swagger UI is mounted on. */
export const OPENAPI_UI_PATH = 'api';

/**
 * `@nestjs/swagger@11` can stamp an arbitrary version string on the document
 * but still emits 3.0-only keywords such as `nullable`. Declaring 3.1 would
 * therefore produce a document that lies about its own dialect, so the API is
 * published as the newest 3.0 patch instead.
 */
const OPENAPI_VERSION = '3.0.3';

const API_DESCRIPTION = `
REST API for account management, session management and cryptocurrency price alerts.

## Response envelopes

Every response is enveloped. A successful response carries \`data\`:

\`\`\`json
{ "data": { "username": "mohammad_reza" } }
\`\`\`

A failing response carries \`error\` instead, and never both:

\`\`\`json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "domain": "USER",
    "message": "User not found",
    "meta": { "userId": "7c4f2f6a-1f2d-4a1b-9c3e-8d5b6a0e1f24" },
    "path": "/v1/user/me",
    "timestamp": "2026-08-02T14:35:00.000Z"
  }
}
\`\`\`

Branch on \`error.code\`, never on \`error.message\`. \`204 No Content\` responses
carry no body at all.

## Authentication

Authentication is **cookie-based**; the API does not read \`Authorization\` headers.

1. \`POST /v1/auth/register\` creates a pending account and emails a six-digit code.
2. \`POST /v1/auth/verify-email\` activates it.
3. \`POST /v1/auth/login\` sets three cookies and returns an empty envelope —
   tokens are never placed in the response body.

| Cookie | Lifetime | Flags | Purpose |
| --- | --- | --- | --- |
| \`${AuthCookie.ACCESS_TOKEN}\` | 15 minutes | \`HttpOnly\` | Authenticates every request |
| \`${AuthCookie.REFRESH_TOKEN}\` | 7 days | \`HttpOnly\` | Consumed by \`POST /v1/auth/refresh\` |
| \`${AuthCookie.CSRF_TOKEN}\` | session | readable by JS | Echoed back in \`${CSRF_HEADER}\` |

\`Secure\` and \`SameSite=Strict\` are set in production; development uses
\`SameSite=Lax\` over plain HTTP.

\`POST /v1/auth/refresh\` rotates both tokens. Refresh tokens are single-use:
replaying one revokes the whole session and returns \`401 SESSION_REUSE_DETECTED\`.

## CSRF

Unsafe methods (\`POST\`, \`PUT\`, \`PATCH\`, \`DELETE\`) on authenticated routes require
the \`${AuthCookie.CSRF_TOKEN}\` cookie value to be repeated in the \`${CSRF_HEADER}\`
header. Mismatches return \`403 INVALID_CSRF_TOKEN\`. The public \`/v1/auth/*\`
endpoints are exempt.

## Pagination

Collections are cursor-paginated and forward-only. Send \`limit\` to size the page
and \`cursor\` to continue from a previous response. Each response returns
\`nextCursor\`, which is \`null\` on the last page. Cursors are opaque base64url
values: pass them back verbatim. A cursor that was tampered with, or whose sort
parameters no longer match the request, returns \`400 INVALID_CURSOR\`. There is no
backward cursor and no total count.

## Validation

Request validation rejects unknown properties and returns
\`422 VALIDATION_ERROR\` reporting the first failing field in \`error.meta.field\`.

## Rate limiting

Authentication endpoints are rate limited per IP and per route; exceeding a
budget returns \`429\`. Per-endpoint budgets are documented on each operation.
`.trim();

/**
 * Builds the OpenAPI document. Kept separate from the Swagger UI wiring so the
 * specification can also be produced outside of a running HTTP server.
 */
export function buildOpenApiDocument(
  app: INestApplication,
  { servers }: OpenApiOptions
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('NestBackend API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0.0')
    .setContact(
      'NestBackend maintainers',
      'https://github.com/l1mindr/nest-backend/issues',
      'l1mindr@proton.me'
    )
    .setLicense(
      'UNLICENSED',
      'https://github.com/l1mindr/nest-backend/blob/master/package.json'
    )
    .setTermsOfService('https://github.com/l1mindr/nest-backend#readme')
    .setExternalDoc(
      'Architecture and API guides',
      'https://github.com/l1mindr/nest-backend/tree/master/docs'
    )
    .setOpenAPIVersion(OPENAPI_VERSION)
    .addCookieAuth(
      AuthCookie.ACCESS_TOKEN,
      {
        type: 'apiKey',
        in: 'cookie',
        name: AuthCookie.ACCESS_TOKEN,
        description:
          'Short-lived access token issued by `POST /v1/auth/login`. Set as an `HttpOnly` cookie, so a browser attaches it automatically; it cannot be read or set from JavaScript.'
      },
      SecurityScheme.ACCESS_TOKEN
    )
    .addCookieAuth(
      AuthCookie.REFRESH_TOKEN,
      {
        type: 'apiKey',
        in: 'cookie',
        name: AuthCookie.REFRESH_TOKEN,
        description:
          'Single-use refresh token consumed by `POST /v1/auth/refresh`. Set as an `HttpOnly` cookie.'
      },
      SecurityScheme.REFRESH_TOKEN
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: CSRF_HEADER,
        description:
          'Double-submit CSRF token. Copy the value of the `csrf_token` cookie into this header on every unsafe request to an authenticated route.'
      },
      SecurityScheme.CSRF_TOKEN
    )
    .addTag(
      ApiTagName.AUTHENTICATION,
      'Registration, email verification, login, token refresh and password change. Every endpoint here is public except password change.'
    )
    .addTag(
      ApiTagName.USER_PROFILE,
      'Read, update and delete the profile of the authenticated user.'
    )
    .addTag(
      ApiTagName.SESSIONS,
      'Inspect the devices signed in to the account and revoke them.'
    )
    .addTag(
      ApiTagName.COINS,
      'Catalogue of cryptocurrencies that price alerts can be created against.'
    )
    .addTag(
      ApiTagName.PRICE_ALERTS,
      'Create, list, update and cancel price alerts owned by the authenticated user.'
    )
    .addTag(
      ApiTagName.ADMIN_USERS,
      'User administration. Restricted to callers holding the `ADMIN` role.'
    );

  servers.forEach(({ url, description }) => config.addServer(url, description));

  return SwaggerModule.createDocument(app, config.build());
}

/** Mounts the Swagger UI and the raw specification endpoints. */
export function setupOpenApiUi(
  app: INestApplication,
  document: OpenAPIObject
): void {
  SwaggerModule.setup(OPENAPI_UI_PATH, app, document, {
    customSiteTitle: 'NestBackend API reference',
    jsonDocumentUrl: `${OPENAPI_UI_PATH}/openapi.json`,
    yamlDocumentUrl: `${OPENAPI_UI_PATH}/openapi.yaml`,
    swaggerOptions: {
      // Authentication rides on HttpOnly cookies, so the browser has to be
      // allowed to attach them to the requests the UI fires.
      withCredentials: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 3,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
      syntaxHighlight: { activate: true, theme: 'nord' }
    }
  });
}
