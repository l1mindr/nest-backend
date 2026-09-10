import { ClockService } from '@infrastructure/clock/clock.service';
import { User } from '@features/users/domain/entities/user.entity';
import {
  IUserActivityRecorder,
  USER_ACTIVITY_RECORDER
} from '@features/activity/application/interfaces/activity.interface';
import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { Session } from '../../domain/entities/session.entity';
import { ISessionDevice } from '../interfaces/session-device.interface';
import {
  ISessionIssueUseCase,
  ISessionRepository,
  SESSION_REPOSITORY
} from '../interfaces/sessions.interface';

@Injectable()
export class SessionIssueUseCase implements ISessionIssueUseCase {
  constructor(
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(USER_ACTIVITY_RECORDER)
    private readonly activityRecorder: IUserActivityRecorder
  ) {}

  async execute(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session> {
    const maxSessions = this.configService.getOrThrow<number>(
      'MAX_ACTIVE_SESSIONS'
    );

    const { now } = this.clockService.snapshot();
    const nowDate = this.clockService.dateFromMs(now);

    const session = await this.issueWithinTransaction(
      userId,
      ipAddress,
      device,
      expiresAt,
      maxSessions,
      nowDate
    );

    // After the transaction commits, so a rolled-back issue leaves no record
    // of a device that was never signed in. The device is worth carrying: on a
    // security screen "a session started on Chrome / macOS" is the detail that
    // makes the row actionable.
    this.activityRecorder.record({
      userId,
      category: ActivityCategory.SECURITY,
      action: ActivityAction.SESSION_CREATED,
      entityType: 'SESSION',
      entityId: session.id,
      metadata: {
        browserName: device.browserName,
        osName: device.osName,
        deviceType: device.deviceType
      }
    });

    return session;
  }

  private issueWithinTransaction(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date,
    maxSessions: number,
    nowDate: Date
  ): Promise<Session> {
    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .select('user.id')
        .where('user.id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOneOrFail();

      const session = await this.sessionRepository.createSession({
        userId,
        ipAddress,
        device,
        expiresAt,
        now: nowDate,
        manager
      });

      const activeCount = await this.sessionRepository.countActiveSessions(
        userId,
        nowDate,
        manager
      );

      if (activeCount > maxSessions) {
        const excess = activeCount - maxSessions;

        const toRevoke = await manager
          .getRepository(Session)
          .createQueryBuilder('session')
          .select('session.id')
          .where('session.owner = :userId', { userId })
          .andWhere('session.isRevoked = false')
          .andWhere('session.expiresAt > :now', { now: nowDate })
          .orderBy('session.lastUsedAt', 'ASC')
          .addOrderBy('session.createdAt', 'ASC')
          .addOrderBy('session.id', 'ASC')
          .take(excess)
          .getMany();

        if (toRevoke.length) {
          const ids = toRevoke.map((s) => s.id);
          await manager
            .getRepository(Session)
            .update({ id: In(ids) }, { isRevoked: true });
        }
      }

      return session;
    });
  }
}
