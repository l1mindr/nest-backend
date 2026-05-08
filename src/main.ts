import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.listen(8080);
}

bootstrap();
