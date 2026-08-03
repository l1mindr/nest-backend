export interface ReadBodyStringOptions {
  readonly maxLength: number;
  readonly lowercase?: boolean;
}

/**
 * Reads one field out of the *unvalidated* request body.
 *
 * Guards run after body parsing but before the validation pipe, so the body
 * arrives exactly as the client sent it: it may be absent, a bare string, an
 * array, or an object smuggling an operator such as `{ "$ne": null }`. Only a
 * plain-object body carrying a genuine `string` at `field` yields a value;
 * everything else resolves to `null`, which means "skip this rule", not "deny".
 *
 * Truncation happens before the caller hashes the value, so an oversized field
 * cannot turn into unbounded work.
 */
export function readBodyString(
  body: unknown,
  field: string,
  { maxLength, lowercase = false }: ReadBodyStringOptions
): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }

  const raw = (body as Record<string, unknown>)[field];

  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim().slice(0, maxLength);

  if (trimmed.length === 0) return null;

  return lowercase ? trimmed.toLowerCase() : trimmed;
}
