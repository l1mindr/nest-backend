import { Session } from '../entities/session.entity';

export type SessionListItem = Session & {
  current?: boolean;
};
