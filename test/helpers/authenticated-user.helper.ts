import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export class AuthenticatedUser {
  constructor(
    private readonly app: INestApplication,
    private readonly cookie: string[]
  ) {}

  get(url: string) {
    return request(this.app.getHttpServer())
      .get(url)
      .set('Cookie', this.cookie);
  }

  post(url: string) {
    return request(this.app.getHttpServer())
      .post(url)
      .set('Cookie', this.cookie);
  }

  put(url: string) {
    return request(this.app.getHttpServer())
      .put(url)
      .set('Cookie', this.cookie);
  }

  delete(url: string) {
    return request(this.app.getHttpServer())
      .delete(url)
      .set('Cookie', this.cookie);
  }
}
