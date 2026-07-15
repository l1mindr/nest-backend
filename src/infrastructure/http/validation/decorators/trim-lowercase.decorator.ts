import { Transform } from 'class-transformer';

export const TrimLowercase = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  );
