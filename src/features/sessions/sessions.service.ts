import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, MoreThan, Not, Repository } from 'typeorm';
import { ISessionDevice } from './interfaces/session-device.interface';
import { ISessionsService } from './interfaces/sessions.interface';
import { SessionListItem } from './types/session-list-item.type';

@Injectable()
export class SessionsService implements ISessionsService {
  constructor(private readonly dataSource: DataSource) {}

  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  async issue(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ) {
    return await this.sessionRepo.create({
      owner: { id: userId },
      ipAddress,
      device,
      expiresAt,
      lastUsedAt: new Date(),
      refreshTokenHash: randomUUID()
    });
  }

  async getActive(userId: string, sessionId: string): Promise<Session | null> {
    return this.sessionRepo.findOne({
      where: {
        id: sessionId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
        owner: {
          id: userId
        }
      }
    });
  }

  async list({
    user: { id },
    session
  }: CustomAuth): Promise<SessionListItem[]> {
    const sessions = await this.sessionRepo.find({
      where: {
        owner: { id },
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
        id: Not(session.id)
      },
      select: ['device', 'expiresAt', 'ipAddress']
    });

    return [{ ...session, current: true }, ...sessions];
  }

  async revoke({ id }: User, sessionId: string): Promise<void> {
    await this.sessionRepo.update(
      {
        owner: { id },
        id: sessionId
      },
      {
        isRevoked: true
      }
    );
  }

  async terminateOthers({ id }: User, sessionId: string): Promise<void> {
    await this.sessionRepo.update(
      {
        owner: { id },
        id: Not(sessionId)
      },
      {
        isRevoked: true
      }
    );
  }

  async updateRefreshState(
    session: Session,
    payload: Partial<Session>
  ): Promise<void> {
    Object.assign(session, payload);
    await this.sessionRepo.save(session);
  }
}
