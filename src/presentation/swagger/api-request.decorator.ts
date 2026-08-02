import { Type, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

export interface ApiRequestBodyExample {
  /** Label shown in the Swagger UI example picker. */
  summary: string;
  /** The request payload, keyed by DTO property name. */
  value: Record<string, unknown>;
}

/**
 * Documents a JSON request body together with one or more concrete examples.
 *
 * Uses the schema form of `ApiBody` because the `examples` keyword only exists
 * on that variant. `ApiExtraModels` keeps the referenced DTO registered in
 * `components/schemas` so the `$ref` never dangles.
 */
export const ApiRequestBody = (
  type: Type<unknown>,
  examples: ApiRequestBodyExample[]
) =>
  applyDecorators(
    ApiExtraModels(type),
    ApiBody({
      required: true,
      schema: { $ref: getSchemaPath(type) },
      examples: Object.fromEntries(
        examples.map(({ summary, value }) => [summary, { summary, value }])
      )
    })
  );
