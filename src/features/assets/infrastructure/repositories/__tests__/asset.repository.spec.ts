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
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder)
  };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue(ormRepository),
    query: jest.fn().mockResolvedValue([])
  };

  let repository: AssetRepository;

  const makeAsset = (index: number) => ({
    coinGeckoId: `coin-${index}`,
    symbol: `c${index}`,
    name: `Coin ${index}`,
    imageUrl: null,
    currentPrice: index === 0 ? '96785.25' : null,
    marketCap: null,
    marketCapRank: index,
    totalVolume: null,
    circulatingSupply: null,
    totalSupply: null,
    maxSupply: null,
    priceChange24h: null,
    priceChangePercentage24h: null,
    lastSyncedAt: new Date('2026-07-28T08:00:00.000Z')
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ormRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    dataSource.query.mockResolvedValue([]);
    repository = new AssetRepository(dataSource as unknown as DataSource);
  });

  it('should upsert in bounded batches via one parameterized statement per batch', async () => {
    const assets = Array.from({ length: 1_001 }, (_, index) =>
      makeAsset(index)
    );

    await repository.upsertMany(assets);

    expect(dataSource.query).toHaveBeenCalledTimes(2);

    const [firstSql, firstParams] = dataSource.query.mock.calls[0];
    const [, secondParams] = dataSource.query.mock.calls[1];

    expect(firstSql).toContain('INSERT INTO "asset"');
    expect(firstSql).toContain('ON CONFLICT ("coinGeckoId")');
    expect(firstParams).toHaveLength(1_000 * 14);
    expect(secondParams).toHaveLength(14);
  });

  it('should preserve an existing currentPrice when the incoming value is null', async () => {
    const assets = [makeAsset(0)];

    await repository.upsertMany(assets);

    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain(
      'COALESCE(EXCLUDED."currentPrice", "asset"."currentPrice")'
    );
  });

  it('should skip no-op rows so updatedAt is not churned pointlessly', async () => {
    const assets = [makeAsset(1)];

    await repository.upsertMany(assets);

    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE (');
    expect(sql).toContain('IS DISTINCT FROM');
    expect(sql).toContain('"updatedAt" = now()');
  });

  it('should omit the conflict key from the update clause', async () => {
    const assets = [makeAsset(0)];

    await repository.upsertMany(assets);

    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).not.toContain('"coinGeckoId" = EXCLUDED."coinGeckoId"');
  });

  it('should pass large supply values through as plain decimal strings', async () => {
    const assets = [
      {
        ...makeAsset(0),
        circulatingSupply: '10000000000000000000000.00000000',
        totalSupply: '21000000000000000000000.00000000',
        maxSupply: '21000000000000000000000.00000000'
      }
    ];

    await repository.upsertMany(assets);

    const params = dataSource.query.mock.calls[0][1] as string[];
    expect(params).toContain('10000000000000000000000.00000000');
    expect(params).toContain('21000000000000000000000.00000000');
  });

  it('should handle values exceeding NUMERIC(30,8) capacity', async () => {
    const assets = [
      {
        ...makeAsset(0),
        currentPrice: '100000000000000000000000',
        circulatingSupply: '420690000000000000000000',
        totalSupply: '1000000000000000000000000',
        maxSupply: '1000000000000000000000000',
        priceChange24h: '50000000000000000000000'
      }
    ];

    await repository.upsertMany(assets);

    const params = dataSource.query.mock.calls[0][1] as string[];
    expect(params).toContain('100000000000000000000000');
    expect(params).toContain('420690000000000000000000');
    expect(params).toContain('1000000000000000000000000');
    expect(params).toContain('50000000000000000000000');
  });

  it('should find an asset by id', async () => {
    ormRepository.findOneBy.mockResolvedValue({ id: 'asset-1' });

    const asset = await repository.findById('asset-1');

    expect(ormRepository.findOneBy).toHaveBeenCalledWith({ id: 'asset-1' });
    expect(asset).toEqual({ id: 'asset-1' });
  });

  it('should list assets with search, cursor and limit', async () => {
    queryBuilder.getMany.mockResolvedValue([{ id: 'asset-1' }]);

    const result = await repository.list({
      search: 'bit',
      cursorId: 'cursor-1',
      limit: 21
    });

    expect(queryBuilder.where).toHaveBeenCalledWith(
      '(asset.symbol ILIKE :q OR asset.name ILIKE :q OR asset.coinGeckoId ILIKE :q)',
      { q: '%bit%' }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('asset.id > :cursorId', {
      cursorId: 'cursor-1'
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('asset.id', 'ASC');
    expect(queryBuilder.take).toHaveBeenCalledWith(21);
    expect(result).toEqual([{ id: 'asset-1' }]);
  });
});
