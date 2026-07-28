import { DataSource } from 'typeorm';
import { PriceAlert } from '../../../domain/entities/price-alert.entity';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../../domain/enums/alert-status.enum';
import { AlertTriggerMode } from '../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { PriceAlertRepository } from '../price-alert.repository';

describe('PriceAlertRepository', () => {
  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    getMany: jest.fn(),
    getRawMany: jest.fn()
  };
  const ormRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    update: jest.fn()
  };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue(ormRepository)
  };

  let repository: PriceAlertRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    ormRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    repository = new PriceAlertRepository(dataSource as unknown as DataSource);
  });

  it('should create alerts as active', async () => {
    const data = {
      userId: 'user-id',
      coinId: 'bitcoin',
      direction: AlertDirection.SELL,
      targetPrice: '120000',
      triggerMode: AlertTriggerMode.ONCE,
      expiresAt: null,
      notificationChannels: [NotificationChannel.EMAIL]
    };
    const alert = { id: 'alert-id', ...data } as PriceAlert;
    ormRepository.create.mockReturnValue(alert);
    ormRepository.save.mockResolvedValue(alert);

    await expect(repository.create(data)).resolves.toBe(alert);
    expect(ormRepository.create).toHaveBeenCalledWith({
      ...data,
      status: AlertStatus.ACTIVE
    });
  });

  it('should scope detail queries to the owning user', async () => {
    await repository.findByIdAndUser('alert-id', 'user-id');

    expect(ormRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'alert-id', userId: 'user-id' },
      relations: { coin: true }
    });
  });

  it('should apply ownership and list filters in the query', async () => {
    queryBuilder.getMany.mockResolvedValue([]);

    await repository.listByUser('user-id', {
      cursorId: 'cursor-id',
      limit: 21,
      status: AlertStatus.ACTIVE,
      direction: AlertDirection.BUY,
      coinId: 'bitcoin'
    });

    expect(queryBuilder.where).toHaveBeenCalledWith('alert.userId = :userId', {
      userId: 'user-id'
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'alert.status = :status',
      { status: AlertStatus.ACTIVE }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'alert.direction = :direction',
      { direction: AlertDirection.BUY }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'alert.coinId = :coinId',
      { coinId: 'bitcoin' }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('alert.id > :cursorId', {
      cursorId: 'cursor-id'
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('alert.id', 'ASC');
    expect(queryBuilder.take).toHaveBeenCalledWith(21);
  });

  it('should bulk expire only active alerts whose lifetime ended', async () => {
    const now = new Date('2026-07-28T08:00:00.000Z');
    queryBuilder.execute.mockResolvedValue({
      raw: [{ id: 'alert-id', userId: 'user-id', coinId: 'bitcoin' }]
    });

    await expect(repository.expireActiveAlerts(now)).resolves.toEqual([
      { id: 'alert-id', userId: 'user-id', coinId: 'bitcoin' }
    ]);
    expect(queryBuilder.set).toHaveBeenCalledWith({
      status: AlertStatus.EXPIRED
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('"expiresAt" < :now', {
      now
    });
  });

  it('should retrieve distinct active coin ids for batched pricing', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { coinId: 'bitcoin' },
      { coinId: 'ethereum' }
    ]);

    await expect(repository.findActiveCoinIdsForScheduler()).resolves.toEqual([
      'bitcoin',
      'ethereum'
    ]);
    expect(queryBuilder.distinct).toHaveBeenCalledWith(true);
    expect(queryBuilder.where).toHaveBeenCalledWith('alert.status = :status', {
      status: AlertStatus.ACTIVE
    });
  });

  it('should atomically increment the trigger count for active alerts', async () => {
    queryBuilder.execute.mockResolvedValue({ affected: 1 });
    const lastTriggeredAt = new Date('2026-07-28T08:00:00.000Z');

    await expect(
      repository.markTriggered('alert-id', {
        lastCheckedPrice: '120000',
        lastTriggeredAt,
        status: AlertStatus.TRIGGERED
      })
    ).resolves.toBe(true);

    expect(queryBuilder.set).toHaveBeenCalledWith({
      lastCheckedPrice: '120000',
      lastTriggeredAt,
      status: AlertStatus.TRIGGERED,
      triggeredCount: expect.any(Function)
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '"status" = :activeStatus',
      { activeStatus: AlertStatus.ACTIVE }
    );
  });

  it('should update only an owned alert', async () => {
    await repository.updateOwned('alert-id', 'user-id', {
      status: AlertStatus.CANCELLED
    });

    expect(ormRepository.update).toHaveBeenCalledWith(
      { id: 'alert-id', userId: 'user-id' },
      { status: AlertStatus.CANCELLED }
    );
  });
});
