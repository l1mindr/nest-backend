import { ErrorDomain } from './error-domain.enum';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly domain: ErrorDomain,
    public readonly statusCode: number,
    public readonly metadata?: Record<string, unknown>,
    message?: string
  ) {
    super(message);
  }
}
