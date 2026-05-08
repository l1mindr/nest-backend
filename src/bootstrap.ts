import { HttpExceptionFilter } from '@core/common/filters/http-exception.filter';
import { INestApplication, VersioningType } from '@nestjs/common';
import compression from 'compression';
import cookieParser from 'cookie-parser';

export async function setupApp(app: INestApplication) {
  app.use(
    compression({
      level: 6,
      filter: (req) => req.headers['accept-encoding']?.includes('gzip'),
      threshold: 1024
    })
  );

  app.enableVersioning({
    type: VersioningType.URI
  });

  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());
}
