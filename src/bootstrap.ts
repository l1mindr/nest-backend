import { HttpExceptionFilter } from '@core/common/filters/http-exception.filter';
import { INestApplication, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';

export async function setupApp(app: INestApplication) {
  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('The NestjsBackend API description')
      .setDescription('Use the base API URL at http://localhost:8080')
      .setTermsOfService('Connect with email: l1mindr@proton.me')
      .addServer('http://localhost:8080')
      .setVersion('1')
      .addTag('API routes')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

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
