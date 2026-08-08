import { DataSource } from 'typeorm';
import { AssetRepository } from '../asset.repository';

describe('AssetRepository', () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn()
  };
  const ormRepository = {
    upsert: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder)
  };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue(ormRepository)
  };

  let repository: AssetRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    ormRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    repository = new AssetRepository(dataSource as unknown as DataSource);
  });

  it('should upsert in bounded batches', async () => {
    const assets = Array.from({ length: 1_001 }, (_, index) => ({
      coinGeckoId: `coin-${index}`,
      symbol: `c${index}`,
      name: `Coin ${index}`,
      imageUrl: null,
      currentPrice: null,
      marketCap: null,
      marketCapRank: null,
      totalVolume: null,
      circulatingSupply: null,
      totalSupply: null,
      maxSupply: null,
      priceChange24h: null,
      priceChangePercentage24h: null,
      lastSyncedAt: new Date('2026-07-28T08:00:00.000Z')
    }));

    await repository.upsertMany(assets);

    expect(ormRepository.upsert).toHaveBeenCalledTimes(2);
    expect(ormRepository.upsert.mock.calls[0][0]).toHaveLength(1_000);
    expect(ormRepository.upsert.mock.calls[1][0]).toHaveLength(1);
    expect(ormRepository.upsert).toHaveBeenCalledWith(expect.any(Array), {
      conflictPaths: ['coinGeckoId'],
      skipUpdateIfNoValuesChanged: true
    });
  });

  it('should find asset by id', async () => {
    const asset = { id: 'asset-id' } as any;
    ormRepository.findOneBy.mockResolvedValue(asset);

    await expect(repository.findById('asset-id')).resolves.toBe(asset);
    expect(ormRepository.findOneBy).toHaveBeenCalledWith({ id: 'asset-id' });
  });

  it('should build list query with search, cursor, status', async () => {
    queryBuilder.getMany.mockResolvedValue([]);

    await repository.list({
      search: 'bit',
      cursorId: '00000000-0000-4000-8000-000000000001',
      limit: 21
    });

    expect(queryBuilder.where).toHaveBeenCalledWith(
      '(asset.symbol ILIKE :q OR asset.name ILIKE :q OR asset.coinGeckoId ILIKE :q)',
      { q: '%bit%' }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('asset.id > :cursorId', {
      cursorId: '00000000-0000-4000-8000-000000000001'
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('asset.id', 'ASC');
    expect(queryBuilder.take).toHaveBeenCalledWith(21);
  });
});
