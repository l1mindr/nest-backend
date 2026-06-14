import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { Request } from 'express';

export interface CustomAuth {
  readonly user: User;
  readonly session: Session;
}

export interface IRequest extends Request {
  user: User;
  session: Session;
}
