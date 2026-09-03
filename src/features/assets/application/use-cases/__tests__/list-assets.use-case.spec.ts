import { encodeCursor } from '@core/pagination/cursor.util';
import { AssetErrorCode } from '../../../domain/errors/asset-error-code.enum';
import { ListAssetsUseCase } from '../list-assets.use-case';

describe('ListAssetsUseCase', () => {
  const assetRepository = {
    list: jest.fn()
  };

  let useCase: ListAssetsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListAssetsUseCase(assetRepository as any);
  });

  it('should paginate results and return a cursor encoding rank and id', async () => {
    const assets = Array.from({ length: 21 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      symbol: `c${index}`,
      name: `Coin ${index}`,
      marketCapRank: index + 1
    }));
    assetRepository.list.mockResolvedValue(assets);

    const result = await useCase.execute({});

    expect(assetRepository.list).toHaveBeenCalledWith({
      search: '',
      cursor: null,
      limit: 21
    });
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe(encodeCursor(`20:${assets[19].id}`));
  });

  it('should encode a null-rank cursor with the literal "null" rank marker', async () => {
    const assets = Array.from({ length: 2 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      symbol: `c${index}`,
      name: `Coin ${index}`,
      marketCapRank: null
    }));
    assetRepository.list.mockResolvedValue(assets);

    const result = await useCase.execute({ limit: 1 });

    expect(result.nextCursor).toBe(encodeCursor(`null:${assets[0].id}`));
  });

  it('should return null nextCursor on last page', async () => {
    const assets = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        marketCapRank: 1
      }
    ];
    assetRepository.list.mockResolvedValue(assets);

    const result = await useCase.execute({});

    expect(result.items).toEqual(assets);
    expect(result.nextCursor).toBeNull();
  });

  it('should throw ASSET_INVALID_CURSOR for a malformed cursor', async () => {
    await expect(
      useCase.execute({ cursor: 'not-base64url' })
    ).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_INVALID_CURSOR
    });

    // No separator between the rank and id halves.
    await expect(
      useCase.execute({ cursor: encodeCursor('not-a-uuid') })
    ).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_INVALID_CURSOR
    });

    // Separator present but the id half is not a UUID.
    await expect(
      useCase.execute({ cursor: encodeCursor('5:not-a-uuid') })
    ).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_INVALID_CURSOR
    });

    // Separator present but the rank half is neither "null" nor an integer.
    await expect(
      useCase.execute({
        cursor: encodeCursor('abc:00000000-0000-4000-8000-000000000001')
      })
    ).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_INVALID_CURSOR
    });

    expect(assetRepository.list).not.toHaveBeenCalled();
  });

  it('should decode a ranked cursor and pass it through to the repository', async () => {
    const cursor = encodeCursor('5:00000000-0000-4000-8000-000000000001');
    assetRepository.list.mockResolvedValue([]);

    await useCase.execute({ search: 'bit', cursor, limit: 5 });

    expect(assetRepository.list).toHaveBeenCalledWith({
      search: 'bit',
      cursor: { marketCapRank: 5, id: '00000000-0000-4000-8000-000000000001' },
      limit: 6
    });
  });

  it('should decode a null-rank cursor and pass it through to the repository', async () => {
    const cursor = encodeCursor('null:00000000-0000-4000-8000-000000000001');
    assetRepository.list.mockResolvedValue([]);

    await useCase.execute({ cursor });

    expect(assetRepository.list).toHaveBeenCalledWith({
      search: '',
      cursor: {
        marketCapRank: null,
        id: '00000000-0000-4000-8000-000000000001'
      },
      limit: 21
    });
  });
});
