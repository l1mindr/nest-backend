import { JwtPayload } from '@features/auth/interfaces/jwt-payload.interface';
import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { DataSource, MoreThan, Not, Repository } from 'typeorm';
import { IDevice } from './interfaces/device.interface';
import { ISessionWithCurrent } from './interfaces/session-with-current.interface';
import { ISessionsService } from './interfaces/sessions.interface';

@Injectable()
export class SessionsService implements ISessionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService
  ) {}

  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  async issue(userId: string, ip: string, device: IDevice): Promise<string> {
    return await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(Session);

      const payload: JwtPayload = { sub: userId, jti: randomUUID() };
      const token = this.jwtService.sign(payload);

      const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60 * 1000;

      const session = sessionRepo.create({
        owner: { id: userId },
        ip,
        device,
        token,
        expiryDate: new Date(Date.now() + THIRTY_ONE_DAYS)
      });

      try {
        await sessionRepo.save(session);
      } catch {
        throw new InternalServerErrorException('Failed to create session');
      }
      return token;
    });
  }

  async getActive(userId: string, token: string): Promise<Session | null> {
    return this.sessionRepo.findOne({
      where: {
        token,
        owner: {
          id: userId
        },
        expiryDate: MoreThan(new Date())
      }
    });
  }

  async list({
    user: { id },
    session: { token, ip, expiryDate, device }
  }: CustomAuth): Promise<ISessionWithCurrent[]> {
    const sessions = await this.sessionRepo.find({
      where: {
        owner: { id },
        token: Not(token)
      },
      select: ['device', 'expiryDate', 'ip']
    });

    const currentSession: ISessionWithCurrent = {
      ip,
      expiryDate,
      device,
      current: true
    };

    return [currentSession, ...sessions];
  }

  async revoke({ id }: User, token: string): Promise<void> {
    await this.sessionRepo.delete({
      owner: { id },
      token
    });
  }

  async terminateOthers({ id }: User, token: string): Promise<void> {
    await this.sessionRepo.delete({
      owner: { id },
      token: Not(token)
    });
  }
}
