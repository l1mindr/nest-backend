import helmet from 'helmet';
import { IS_DEVELOPMENT } from '@infrastructure/config/env/env.constants';

/**
 * Helmet security middleware configuration.
 *
 * Swagger UI (development only) requires relaxed CSP to load its assets:
 * - inline scripts for UI initialization
 * - inline styles for syntax highlighting
 * - external resources from CDN (swagger-ui-dist bundle)
 *
 * In production, secure defaults are used since no browser-facing UI is served.
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: IS_DEVELOPMENT
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:']
        }
      }
    : undefined, // Use Helmet's secure defaults in production
  crossOriginEmbedderPolicy: IS_DEVELOPMENT ? false : undefined
});
