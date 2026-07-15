import { Request } from 'express';

export function decodeSessionId(token: unknown): string | undefined {
  if (typeof token !== 'string') return undefined;

  const segments = token.split('.');

  if (segments.length !== 3) return undefined;

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(segments[1], 'base64url').toString('utf8')
    );

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'sessionId' in payload &&
      typeof payload.sessionId === 'string'
    ) {
      return payload.sessionId;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function extractSessionIdFromAuthCookies(
  req: Request
): string | undefined {
  return (
    decodeSessionId(req.cookies?.access_token) ??
    decodeSessionId(req.cookies?.refresh_token)
  );
}
