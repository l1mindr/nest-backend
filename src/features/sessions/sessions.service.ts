import { JwtPayload } from '@features/auth/interfaces/jwt-payload.interface';
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
import { DataSource, MoreThan, Not, Repository } from 'typeorm';
import { ISessionWithCurrentUpdate } from './interfaces/session-with-current.interface';
import {
  ISessionsService,
  IssuedTokens
} from './interfaces/sessions.interface';
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

  private async generateToken(userId: string, sessionId: string) {
    const jwtPayload: JwtPayload = {
      sub: userId,
      sessionId
      // role
    };
    const accessToken = await this.jwtService.signAsync(
      {
        ...jwtPayload
        // role
      },

      {
        expiresIn: '15m'
      }
    );

    const refreshToken = await this.jwtService.signAsync(jwtPayload, {
      expiresIn: '7d'
    });

    return { accessToken, refreshToken };
  }

  async issue(
    userId: string,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<IssuedTokens> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const sessionRepo = manager.getRepository(Session);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const session = await sessionRepo.save(
          sessionRepo.create({
            owner: { id: userId },
            ipAddress,
            userAgent,
            expiresAt,
            lastUsedAt: new Date()
          })
        );

        const { accessToken, refreshToken } = await this.generateToken(
          userId,
          session.id
        );

        session.refreshTokenHash =
          await this.hashingProvider.hash(refreshToken);

        await sessionRepo.save(session);

        return {
          accessToken,
          refreshToken
        };
      });
    } catch {
      throw new InternalServerErrorException('Failed to create session');
    }
  }

  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const { sub, sessionId } =
      await this.jwtService.verifyAsync<JwtPayload>(refreshToken);

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

    const tokens = await this.generateToken(session.owner.id, session.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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

  async list({
    user: { id },
    session: { refreshTokenHash, ipAddress, expiresAt, userAgent, lastUsedAt }
  }: CustomAuth): Promise<ISessionWithCurrentUpdate[]> {
    const sessions = await this.sessionRepo.find({
      where: {
        owner: { id },
        refreshTokenHash: Not(refreshTokenHash)
      },
      select: ['userAgent', 'expiresAt', 'ipAddress']
    });

    const currentSession: ISessionWithCurrentUpdate = {
      ipAddress,
      expiresAt,
      userAgent,
      lastUsedAt,
      current: true
    };

    return [currentSession, ...sessions];
  }

  async revoke({ id }: User, refreshTokenHash: string): Promise<void> {
    await this.sessionRepo.delete({
      owner: { id },
      refreshTokenHash
    });
  }

  async terminateOthers({ id }: User, token: string): Promise<void> {
    await this.sessionRepo.delete({
      owner: { id },
      refreshTokenHash: Not(token)
    });
  }
}
