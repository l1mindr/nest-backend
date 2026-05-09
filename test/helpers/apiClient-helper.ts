import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';

type HttpMethod = 'get' | 'post' | 'put' | 'delete';
type RequestOptions = {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: string | object;
};
export class ApiClient {
  private readonly agent: InstanceType<typeof TestAgent>;

  constructor(app: INestApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  request({ method, url, headers, query, body }: RequestOptions) {
    let req = this.agent[method](url);

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        req = req.set(key, value);
      });
    }

    if (query) req = req.query(query);

    if (body) req = req.send(body);

    return req;
  }
}
