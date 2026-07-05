export const toBoolean = (value: unknown): unknown => {
  if (value === true || value === false) return value;

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }

  return value;
};
