import { Session } from '@features/sessions/entities/session.entity';
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
    return await this.sessionRepo.save(
      this.sessionRepo.create({
        owner: { id: userId },
        ipAddress,
        device,
        expiresAt,
        lastUsedAt: new Date(),
        refreshTokenHash: randomUUID()
      })
    );
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

  async list(userId: string, session: Session): Promise<SessionListItem[]> {
    const sessions = await this.sessionRepo.find({
      where: {
        owner: { id: userId },
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
        id: Not(session.id)
      },
      select: {
        device: true,
        expiresAt: true,
        ipAddress: true
      }
    });

    return [{ ...session, current: true }, ...sessions];
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    await this.sessionRepo.update(
      {
        owner: { id: userId },
        id: sessionId
      },
      {
        isRevoked: true
      }
    );
  }

  async terminateOthers(userId: string, sessionId: string): Promise<void> {
    await this.sessionRepo.update(
      {
        owner: { id: userId },
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

  async rotateRefreshToken(
    sessionId: string,
    oldHash: string,
    newHash: string,
    meta: {
      lastUsedAt: Date;
      expiresAt: Date;
      rotatedAt: Date;
    }
  ) {
    const result = await this.sessionRepo.query(
      `
        UPDATE session
        SET
          refresh_token_hash = $1,
          rotated_at = $2,
          last_used_at = $3,
          expires_at = $4
        WHERE id = $5
          AND refresh_token_hash = $6
        RETURNING id
      `,
      [
        newHash,
        meta.rotatedAt,
        meta.lastUsedAt,
        meta.expiresAt,
        sessionId,
        oldHash
      ]
    );

    return result.length > 0;
  }
}
