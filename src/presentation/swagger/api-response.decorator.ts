import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus, Type, applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  ApiResponseOptions,
  getSchemaPath
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { ExampleValue } from './openapi.constants';

type ResponseHeaders = ApiResponseOptions['headers'];

export interface ApiDataResponseOptions {
  status: number;
  description: string;
  /** DTO carried inside the `data` envelope. */
  type: Type<unknown>;
  headers?: ResponseHeaders;
}

/**
 * Documents a success response wrapped by `DataResponseInterceptor`.
 *
 * The interceptor is registered globally, so every successful payload reaches
 * the client as `{ "data": <payload> }`. Declaring `type` directly on
 * `@ApiResponse` would document the unwrapped payload and mislead clients.
 */
export const ApiDataResponse = ({
  status,
  description,
  type,
  headers
}: ApiDataResponseOptions) =>
  applyDecorators(
    ApiExtraModels(type),
    ApiResponse({
      status,
      description,
      headers,
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: getSchemaPath(type) } }
      }
    })
  );

export interface ApiEmptyBodyResponseOptions {
  status: number;
  description: string;
  headers?: ResponseHeaders;
}

/**
 * Documents a success response whose handler returns nothing but which still
 * carries a body — the envelope serializes to `{}` because `data` is
 * `undefined`. Used by the endpoints that communicate through cookies or
 * through the status code alone (register, login, refresh).
 *
 * For `204 No Content` use `@ApiNoContentResponse` instead: those responses
 * have no body at all.
 */
export const ApiEmptyBodyResponse = ({
  status,
  description,
  headers
}: ApiEmptyBodyResponseOptions) =>
  ApiResponse({
    status,
    description,
    headers,
    schema: { type: 'object', properties: {} },
    examples: { empty: { summary: 'Empty envelope', value: {} } }
  });

export interface ApiNoContentResponseOptions {
  description: string;
  headers?: ResponseHeaders;
}

/**
 * Documents a `204 No Content` response.
 *
 * These bypass `DataResponseInterceptor` entirely — Express sends no body for
 * a 204 — so unlike {@link ApiEmptyBodyResponse} no schema is declared. Any
 * `content` here would tell clients to parse a body that never arrives.
 */
export const ApiNoContent = ({
  description,
  headers
}: ApiNoContentResponseOptions) =>
  ApiResponse({ status: HttpStatus.NO_CONTENT, description, headers });

/**
 * A single rendered error example.
 *
 * Build these with {@link errorExample} so the documented code, domain and
 * message are taken from the application's own error factories and cannot
 * drift from what the API actually returns.
 */
export interface ApiErrorExample {
  code: string;
  domain: ErrorDomain;
  message: string;
  meta: Record<string, unknown>;
  /** Label shown in the Swagger UI example picker. */
  summary: string;
}

/** Derives a documentation example from a real domain error. */
export const errorExample = (
  error: AppError,
  summary?: string
): ApiErrorExample => ({
  code: error.code,
  domain: error.domain,
  message: error.message,
  meta: error.metadata ?? {},
  summary: summary ?? error.message
});

export interface ApiErrorResponseOptions {
  status: number;
  description: string;
  examples: ApiErrorExample[];
}

const toOpenApiExamples = (examples: ApiErrorExample[], path: string) =>
  Object.fromEntries(
    examples.map(({ summary, ...error }) => [
      error.code,
      {
        summary,
        value: {
          error: {
            ...error,
            path,
            timestamp: ExampleValue.TIMESTAMP
          }
        }
      }
    ])
  );

/**
 * Documents one error status together with every concrete error the endpoint
 * can produce at that status.
 *
 * @param path Request path rendered inside `error.path` of the examples.
 */
export const ApiErrorResponse = (
  path: string,
  { status, description, examples }: ApiErrorResponseOptions
) =>
  applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status,
      description,
      content: {
        'application/json': {
          schema: { $ref: getSchemaPath(ErrorResponseDto) },
          examples: toOpenApiExamples(examples, path)
        }
      }
    })
  );

/**
 * Documents every error status of a single endpoint, threading the endpoint
 * path through the examples so each one reads like a real response.
 */
export const ApiErrorResponses = (
  path: string,
  responses: ApiErrorResponseOptions[]
) =>
  applyDecorators(
    ...responses.map((response) => ApiErrorResponse(path, response))
  );
