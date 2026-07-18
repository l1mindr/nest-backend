import { Session } from '../entities/session.entity';

export class SessionListResponseDto {
  items!: Partial<Session>[];
  nextCursor?: string;
}
