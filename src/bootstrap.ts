import { helmetConfig } from '@infrastructure/http/helmet.config';
import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';

export async function setupApp(app: NestExpressApplication) {
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

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

  app.use(helmetConfig);

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
}
