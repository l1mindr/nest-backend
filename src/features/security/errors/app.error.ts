export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly domain: 'AUTH' | 'SESSION' | 'TOKEN' | 'HTTP' | 'SYSTEM',
    public readonly statusCode: number,
    public readonly metadata?: Record<string, any>,
    message?: string
  ) {
    super(message);
  }
}
