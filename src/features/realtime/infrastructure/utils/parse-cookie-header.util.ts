/**
 * Minimal `Cookie` header parser for the WebSocket handshake, where
 * `cookie-parser`'s Express middleware never runs (it only wraps HTTP
 * request handling). Mirrors the same key=value; decoding cookie-parser
 * applies, without adding a new dependency for a handful of lines.
 */
export function parseCookieHeader(header?: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!header) return cookies;

  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = pair.slice(0, separatorIndex).trim();
    const rawValue = pair.slice(separatorIndex + 1).trim();

    if (!key) continue;

    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
}
