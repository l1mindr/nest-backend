import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PriceAlert } from '../../domain/entities/price-alert.entity';
import { AlertDirection } from '../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../domain/enums/alert-status.enum';
import {
  CreatePriceAlertData,
  ExpiredPriceAlert,
  IPriceAlertRepository,
  UpdatePriceAlertData
} from '../../application/interfaces/coin-tracker.interface';

@Injectable()
export class PriceAlertRepository implements IPriceAlertRepository {
  private get priceAlertRepo(): Repository<PriceAlert> {
    return this.dataSource.getRepository(PriceAlert);
  }

  constructor(private readonly dataSource: DataSource) {}

  async create(
    data: CreatePriceAlertData,
    manager?: EntityManager
  ): Promise<PriceAlert> {
    const repository =
      manager?.getRepository(PriceAlert) ?? this.priceAlertRepo;

    const alert = repository.create({
      ...data,
      status: AlertStatus.ACTIVE
    });

    return repository.save(alert);
  }

  async findByIdAndUser(
    id: string,
    userId: string
  ): Promise<PriceAlert | null> {
    return this.priceAlertRepo.findOne({
      where: { id, userId },
      relations: { coin: true }
    });
  }

  async listByUser(
    userId: string,
    options: {
      cursorId: string | null;
      limit: number;
      status?: AlertStatus;
      direction?: AlertDirection;
      coinId?: string;
    }
  ): Promise<PriceAlert[]> {
    const qb = this.priceAlertRepo
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.coin', 'coin')
      .where('alert.userId = :userId', { userId });

    if (options.status) {
      qb.andWhere('alert.status = :status', { status: options.status });
    }

    if (options.direction) {
      qb.andWhere('alert.direction = :direction', {
        direction: options.direction
      });
    }

    if (options.coinId) {
      qb.andWhere('alert.coinId = :coinId', { coinId: options.coinId });
    }

    if (options.cursorId) {
      qb.andWhere('alert.id > :cursorId', { cursorId: options.cursorId });
    }

    qb.orderBy('alert.id', 'ASC').take(options.limit);

    return qb.getMany();
  }

  async expireActiveAlerts(now: Date): Promise<ExpiredPriceAlert[]> {
    const result = await this.priceAlertRepo
      .createQueryBuilder()
      .update(PriceAlert)
      .set({ status: AlertStatus.EXPIRED })
      .where('"status" = :status', { status: AlertStatus.ACTIVE })
      .andWhere('"expiresAt" IS NOT NULL')
      .andWhere('"expiresAt" < :now', { now })
      .returning(['id', 'userId', 'coinId'])
      .execute();

    return (result.raw as ExpiredPriceAlert[]).map(
      ({ id, userId, coinId }) => ({
        id,
        userId,
        coinId
      })
    );
  }

  async findActiveCoinIdsForScheduler(): Promise<string[]> {
    const rows = await this.priceAlertRepo
      .createQueryBuilder('alert')
      .innerJoin('alert.coin', 'coin')
      .select('alert.coinId', 'coinId')
      .distinct(true)
      .where('alert.status = :status', { status: AlertStatus.ACTIVE })
      .andWhere('coin.isActive = :isActive', { isActive: true })
      .getRawMany<{ coinId: string }>();

    return rows.map(({ coinId }) => coinId);
  }

  async findActiveAlertsForScheduler(options: {
    cursorId: string | null;
    limit: number;
  }): Promise<PriceAlert[]> {
    const qb = this.priceAlertRepo
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.coin', 'coin')
      // The owner comes along because notifying is the whole point of this
      // query and a second lookup per alert would be a round trip per row.
      // Joined column by column rather than with `leftJoinAndSelect`: the
      // scheduler needs an address, and nothing else on a user belongs in a
      // batch this size.
      .leftJoin('alert.owner', 'owner')
      .addSelect(['owner.id', 'owner.email'])
      .where('alert.status = :status', { status: AlertStatus.ACTIVE });

    if (options.cursorId) {
      qb.andWhere('alert.id > :cursorId', { cursorId: options.cursorId });
    }

    return qb.orderBy('alert.id', 'ASC').take(options.limit).getMany();
  }

  async updateOwned(
    id: string,
    userId: string,
    data: UpdatePriceAlertData
  ): Promise<void> {
    await this.priceAlertRepo.update({ id, userId }, data);
  }

  async markTriggered(
    id: string,
    options: {
      lastCheckedPrice: string;
      lastTriggeredAt: Date;
      status: AlertStatus;
    }
  ): Promise<boolean> {
    const result = await this.priceAlertRepo
      .createQueryBuilder()
      .update(PriceAlert)
      .set({
        lastCheckedPrice: options.lastCheckedPrice,
        lastTriggeredAt: options.lastTriggeredAt,
        status: options.status,
        triggeredCount: () => '"triggeredCount" + 1'
      })
      .where('id = :id', { id })
      .andWhere('"status" = :activeStatus', {
        activeStatus: AlertStatus.ACTIVE
      })
      .execute();

    return (result.affected ?? 0) === 1;
  }

  async updateLastCheckedPrice(
    id: string,
    lastCheckedPrice: string
  ): Promise<boolean> {
    const result = await this.priceAlertRepo.update(
      { id, status: AlertStatus.ACTIVE },
      { lastCheckedPrice }
    );

    return (result.affected ?? 0) === 1;
  }
}
