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

  it('should paginate results and return nextCursor', async () => {
    const assets = Array.from({ length: 21 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      symbol: `c${index}`,
      name: `Coin ${index}`
    }));
    assetRepository.list.mockResolvedValue(assets);

    const result = await useCase.execute({});

    expect(assetRepository.list).toHaveBeenCalledWith({
      search: '',
      cursorId: null,
      limit: 21
    });
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe(encodeCursor(assets[19].id));
  });

  it('should return null nextCursor on last page', async () => {
    const assets = [{ id: '00000000-0000-4000-8000-000000000001' }];
    assetRepository.list.mockResolvedValue(assets);

    const result = await useCase.execute({});

    expect(result.items).toEqual(assets);
    expect(result.nextCursor).toBeNull();
  });

  it('should throw ASSET_INVALID_CURSOR for invalid cursor', async () => {
    await expect(
      useCase.execute({ cursor: 'not-base64url' })
    ).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_INVALID_CURSOR
    });

    await expect(
      useCase.execute({ cursor: encodeCursor('not-a-uuid') })
    ).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_INVALID_CURSOR
    });

    expect(assetRepository.list).not.toHaveBeenCalled();
  });

  it('should pass search to repository', async () => {
    const cursor = encodeCursor('00000000-0000-4000-8000-000000000001');
    assetRepository.list.mockResolvedValue([]);

    await useCase.execute({ search: 'bit', cursor, limit: 5 });

    expect(assetRepository.list).toHaveBeenCalledWith({
      search: 'bit',
      cursorId: '00000000-0000-4000-8000-000000000001',
      limit: 6
    });
  });
});
