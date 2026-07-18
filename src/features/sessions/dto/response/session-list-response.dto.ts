import { SessionListItem } from '../../types/session-list-item.type';

export class SessionListResponseDto {
  items!: SessionListItem[];
  nextCursor?: string;
}
