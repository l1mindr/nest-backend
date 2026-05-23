import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, MoreThan, Not, Repository } from 'typeorm';
import { SessionsDto } from './dto/sessions.dto';
import { ISessionsService } from './interfaces/sessions.interface';
import { IUserAgent } from './interfaces/user-agent.interface';

@Injectable()
export class SessionsService implements ISessionsService {
  constructor(private readonly dataSource: DataSource) {}

  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  async issue(
    userId: string,
    ipAddress: string,
    userAgent: IUserAgent,
    expiresAt: Date
  ) {
    return await this.sessionRepo.create({
      owner: { id: userId },
      ipAddress,
      userAgent,
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

  async list({ user: { id }, session }: CustomAuth): Promise<SessionsDto[]> {
    const sessions = await this.sessionRepo.find({
      where: {
        owner: { id },
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
        id: Not(session.id)
      },
      select: ['userAgent', 'expiresAt', 'ipAddress']
    });

    const currentSession: SessionsDto = {
      sessionId: session.id,
      ipAddress: session.ipAddress,
      expiresAt: session.expiresAt,
      device: session.userAgent,
      lastUsedAt: session.lastUsedAt,
      current: true
    };

    const sessionsMap = sessions.map((item): SessionsDto => {
      return {
        sessionId: item.id,
        ipAddress: item.ipAddress,
        expiresAt: item.expiresAt,
        device: item.userAgent,
        lastUsedAt: item.lastUsedAt
      };
    });

    return [currentSession, ...sessionsMap];
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
