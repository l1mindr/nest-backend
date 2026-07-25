import { ClockService } from '@core/clock/clock.service';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Session } from '../entities/session.entity';
import { ISessionDevice } from '../interfaces/session-device.interface';
import {
  IIssueSessionService,
  ISessionRepository,
  SESSION_REPOSITORY
} from '../interfaces/sessions.interface';

@Injectable()
export class IssueSessionService implements IIssueSessionService {
  constructor(
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository
  ) {}

  async createSession(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session> {
    const maxSessions = this.configService.getOrThrow<number>(
      'MAX_ACTIVE_SESSIONS'
    );

    const { now } = this.clockService.snapshot();

    return this.sessionRepository.createSession({
      userId,
      ipAddress,
      device,
      expiresAt,
      now: this.clockService.dateFromMs(now),
      maxSessions
    });
  }
}
