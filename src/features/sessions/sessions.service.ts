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
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Session);

      const session = await repo
        .createQueryBuilder('session')
        .setLock('pessimistic_write')
        .where('session.id = :id', { id: sessionId })
        .getOne();

      if (!session) return false;

      if (session.refreshTokenHash !== oldHash) {
        return false;
      }

      const result = await repo.update(
        {
          id: sessionId,
          refreshTokenHash: oldHash
        },
        {
          refreshTokenHash: newHash,
          rotatedAt: meta.rotatedAt,
          lastUsedAt: meta.lastUsedAt,
          expiresAt: meta.expiresAt
        }
      );

      return result.affected === 1;
    });
  }

  async rotateAtomic(
    sessionId: string,
    version: number,
    oldHash: string,
    newHash: string,
    meta: { now: number; expiresAt: Date }
  ): Promise<boolean> {
    const result = await this.sessionRepo
      .createQueryBuilder()
      .update(Session)
      .set({
        refreshTokenHash: newHash,
        rotatedAt: new Date(meta.now),
        lastUsedAt: new Date(meta.now),
        expiresAt: meta.expiresAt,
        version: () => '"version" + 1'
      })
      .where('id = :id', { id: sessionId })
      .andWhere('refreshTokenHash = :hash', { hash: oldHash })
      .andWhere('version = :version', { version })
      .execute();

    return (result.affected ?? 0) === 1;
  }
}
