import { DataSource } from 'typeorm';
import { Coin } from '../../../domain/entities/coin.entity';
import { CoinSortField } from '../../../domain/enums/coin-sort-field.enum';
import { SortOrder } from '../../../domain/enums/sort-order.enum';
import { CoinRepository } from '../coin.repository';

describe('CoinRepository', () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn()
  };
  const ormRepository = {
    upsert: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder)
  };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue(ormRepository)
  };

  let repository: CoinRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    ormRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    repository = new CoinRepository(dataSource as unknown as DataSource);
  });

  it('should upsert synchronized coins in bounded batches', async () => {
    const coins = Array.from({ length: 1_001 }, (_, index) => ({
      id: `coin-${index}`,
      symbol: `c${index}`,
      name: `Coin ${index}`,
      image: null,
      isActive: true,
      lastSyncedAt: new Date('2026-07-28T08:00:00.000Z')
    }));

    await repository.upsertMany(coins);

    expect(ormRepository.upsert).toHaveBeenCalledTimes(2);
    expect(ormRepository.upsert.mock.calls[0][0]).toHaveLength(1_000);
    expect(ormRepository.upsert.mock.calls[1][0]).toHaveLength(1);
    expect(ormRepository.upsert).toHaveBeenCalledWith(expect.any(Array), {
      conflictPaths: ['id'],
      skipUpdateIfNoValuesChanged: true
    });
  });

  it('should deactivate only currently active coins', async () => {
    await repository.deactivateAll();

    expect(ormRepository.update).toHaveBeenCalledWith(
      { isActive: true },
      { isActive: false }
    );
  });

  it('should find only active coins by id', async () => {
    const coin = { id: 'bitcoin', isActive: true } as Coin;
    ormRepository.findOne.mockResolvedValue(coin);

    await expect(repository.findActiveById('bitcoin')).resolves.toBe(coin);
    expect(ormRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'bitcoin', isActive: true }
    });
  });

  it('should build a searchable stable cursor query', async () => {
    queryBuilder.getMany.mockResolvedValue([]);

    await repository.search({
      search: 'bit',
      cursor: {
        sortBy: CoinSortField.NAME,
        sortOrder: SortOrder.DESC,
        value: 'bitcoin',
        id: 'bitcoin'
      },
      limit: 21,
      sortBy: CoinSortField.NAME,
      sortOrder: SortOrder.DESC
    });

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'coin.isActive = :isActive',
      { isActive: true }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(coin.id ILIKE :q OR coin.name ILIKE :q OR coin.symbol ILIKE :q)',
      { q: '%bit%' }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(LOWER(coin.name) < :cursorValue OR (LOWER(coin.name) = :cursorValue AND coin.id < :cursorId))',
      { cursorValue: 'bitcoin', cursorId: 'bitcoin' }
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'LOWER(coin.name)',
      SortOrder.DESC
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
      'coin.id',
      SortOrder.DESC
    );
    expect(queryBuilder.take).toHaveBeenCalledWith(21);
  });
});
