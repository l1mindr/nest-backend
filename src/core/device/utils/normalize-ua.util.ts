export function normalizeUA(ua?: string): string {
  if (!ua) return '';

  return ua.replace(/\s+/g, ' ').trim().slice(0, 500);
}
