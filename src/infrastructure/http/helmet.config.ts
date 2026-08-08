import { IS_DEVELOPMENT } from '@infrastructure/config/env/env.constants';
import helmet from 'helmet';

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
