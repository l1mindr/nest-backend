import { ApiPropertyOptions } from '@nestjs/swagger';
import { ExampleValue } from '../swagger/openapi.constants';

/**
 * Shared wording for the cursor pagination contract implemented by
 * `paginate()`. Every collection endpoint pulls its `cursor`, `limit` and
 * `nextCursor` documentation from here so the three fields cannot describe
 * different semantics in different modules.
 */

/** `cursor` query parameter. */
export const cursorQueryDocs = (
  example: string = ExampleValue.CURSOR
): ApiPropertyOptions => ({
  description:
    'Opaque cursor copied verbatim from the `nextCursor` of a previous response. Omit it to start at the first page. Pagination is forward-only: there is no backward cursor and no total count.',
  example,
  format: 'base64url'
});

export interface LimitDocsOptions {
  defaultValue: number;
  max: number;
}

/** `limit` query parameter. */
export const limitQueryDocs = ({
  defaultValue,
  max
}: LimitDocsOptions): ApiPropertyOptions => ({
  description: `Number of items to return per page. Defaults to ${defaultValue} when omitted.`,
  type: 'integer',
  minimum: 1,
  maximum: max,
  default: defaultValue,
  example: defaultValue
});

/**
 * `nextCursor` response field.
 *
 * Always present — `paginate()` emits `null` on the last page rather than
 * dropping the key, so clients can loop on `nextCursor !== null`.
 */
export const nextCursorDocs = (
  example: string = ExampleValue.CURSOR
): ApiPropertyOptions => ({
  description:
    'Cursor pointing at the page after this one. `null` when this is the last page.',
  type: String,
  nullable: true,
  example
});
