export type HttpMethod = 'get' | 'post' | 'put' | 'delete';
export type RequestOptions = {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: string | object;
};
