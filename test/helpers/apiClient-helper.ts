import { INestApplication } from '@nestjs/common';
import request, { Test } from 'supertest';
import TestAgent from 'supertest/lib/agent';

type RequestConfig<TBody = Record<string, unknown>> = {
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: TBody;
};

export class ApiClient {
  private readonly agent: InstanceType<typeof TestAgent>;

  constructor(app: INestApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  get(url: string, config?: RequestConfig) {
    return this.send(this.agent.get(url), config);
  }

  post(url: string, config?: RequestConfig) {
    return this.send(this.agent.post(url), config);
  }

  patch(url: string, config?: RequestConfig) {
    return this.send(this.agent.patch(url), config);
  }

  put(url: string, config?: RequestConfig) {
    return this.send(this.agent.put(url), config);
  }

  delete(url: string, config?: RequestConfig) {
    return this.send(this.agent.delete(url), config);
  }

  private send(req: Test, config?: RequestConfig) {
    if (!config) return req;

    const { headers, query, body } = config;

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        req.set(key, value);
      });
    }

    if (query) {
      req.query(query);
    }

    if (body !== undefined) {
      req.send(body);
    }

    return req;
  }
}
