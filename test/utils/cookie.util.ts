export function normalizeHeader(
  setCookieHeader: string | string[] | undefined
): string[] {
  if (!setCookieHeader) return [];
  if (Array.isArray(setCookieHeader)) return setCookieHeader;
  return [setCookieHeader];
}

export function getCookie(setCookies: string[], name: string): string {
  const cookie = setCookies.find((c) => c.startsWith(`${name}=`));

  if (!cookie) return '';

  // extract only key=value part (before ;)
  return cookie.split(';')[0];
}

export function getCookieValue(
  headers: string[],

  name: string
) {
  return getCookie(headers, name).split('=')[1];
}

export function extractRefreshToken(setCookie: string[]) {
  const cookie = setCookie.find((c) => c.startsWith('refresh_token='));

  return cookie?.split(';')[0];
}
