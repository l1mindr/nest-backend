import type { AuthSession, AuthUser } from '@core/http';
import { Request } from 'express';

export interface CustomAuth {
  readonly user: AuthUser;
  readonly session: AuthSession;
}

export interface IRequest extends Request {
  user: AuthUser;
  session: AuthSession;
}
