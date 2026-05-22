import { AuthTokens } from '@features/auth/interfaces/auth.interface';
import { IJwtPayload } from '@features/auth/interfaces/jwt-payload.interface';
import { HashingProvider } from '@features/auth/providers/hashing.provider';
import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { DataSource, MoreThan, Not, Repository } from 'typeorm';
import { SessionsDto } from './dto/sessions.dto';
import { ISessionsService } from './interfaces/sessions.interface';
import { IUserAgent } from './interfaces/user-agent.interface';

@Injectable()
export class SessionsService implements ISessionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly hashingProvider: HashingProvider
  ) {}

  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  private createExpirationDate(now: number): Date {
    return new Date(now + 7 * 24 * 60 * 60 * 1000);
  }

  private async generateToken(
    userId: string,
    sessionId: string,
    now: number,
    expiresAt: Date
  ) {
    const jwtPayload: IJwtPayload = {
      sub: userId,
      sessionId
      // role
    };

    const accessExp = Math.floor(now) / 1000 + 15 * 60;
    const refreshExp = Math.floor(expiresAt.getTime()) / 1000;

    const accessToken = await this.jwtService.signAsync({
      ...jwtPayload,
      exp: accessExp
      // role
    });

    const refreshToken = await this.jwtService.signAsync({
      ...jwtPayload,
      exp: refreshExp
    });

    return { accessToken, refreshToken };
  }

  async issue(
    userId: string,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<AuthTokens> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const sessionRepo = manager.getRepository(Session);

        const now = Date.now();
        const expiresAt = this.createExpirationDate(now);

        const session = await sessionRepo.save(
          sessionRepo.create({
            owner: { id: userId },
            ipAddress,
            userAgent,
            expiresAt,
            lastUsedAt: new Date(),
            refreshTokenHash: randomUUID()
          })
        );

        const { accessToken, refreshToken } = await this.generateToken(
          userId,
          session.id,
          now,
          expiresAt
        );

        session.refreshTokenHash =
          await this.hashingProvider.hash(refreshToken);

        await sessionRepo.save(session);

        return {
          accessToken,
          refreshToken
        };
      });
    } catch (err) {
      console.log('err', err);
      throw new InternalServerErrorException('Failed to create session');
    }
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { sub, sessionId } =
      await this.jwtService.verifyAsync<IJwtPayload>(refreshToken);

    const session = await this.sessionRepo.findOne({
      where: {
        id: sessionId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
        owner: { id: sub }
      },
      relations: {
        owner: true // for adding role after test and caching
      }
    });

    if (!session) throw new UnauthorizedException('invalid session');

    const isValidRefreshToken = await this.hashingProvider.compare(
      refreshToken,
      session.refreshTokenHash
    );

    if (!isValidRefreshToken) {
      session.isRevoked = true;
      await this.sessionRepo.save(session);

      throw new UnauthorizedException('invalid refresh token');
    }
    const now = Date.now();
    const expiresAt = this.createExpirationDate(now);

    const tokens = await this.generateToken(
      session.owner.id,
      session.id,
      now,
      expiresAt
    );

    session.refreshTokenHash = await this.hashingProvider.hash(refreshToken);
    session.lastUsedAt = new Date();
    session.expiresAt = expiresAt;

    await this.sessionRepo.save(session);

    return { ...tokens };
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
}
