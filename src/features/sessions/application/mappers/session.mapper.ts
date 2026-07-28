import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SessionResponseDto } from '../../presentation/dto/response/session.response.dto';
import { SessionListItem } from '../../domain/types/session-list-item.type';

@Injectable()
export class SessionMapper {
  toResponse(session: SessionListItem): SessionResponseDto {
    return plainToInstance(SessionResponseDto, session, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(sessions: SessionListItem[]): SessionResponseDto[] {
    return sessions.map((s) => this.toResponse(s));
  }
}
