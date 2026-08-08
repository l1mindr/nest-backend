import { AssetErrorCode } from '../../../domain/errors/asset-error-code.enum';
import { GetAssetUseCase } from '../get-asset.use-case';

describe('GetAssetUseCase', () => {
  const assetRepository = {
    findById: jest.fn()
  };

  let useCase: GetAssetUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetAssetUseCase(assetRepository as any);
  });

  it('should return asset by id', async () => {
    const asset = { id: 'asset-id', symbol: 'btc' };
    assetRepository.findById.mockResolvedValue(asset);

    await expect(useCase.execute('asset-id')).resolves.toBe(asset);
    expect(assetRepository.findById).toHaveBeenCalledWith('asset-id');
  });

  it('should throw ASSET_NOT_FOUND for unknown id', async () => {
    assetRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toMatchObject({
      code: AssetErrorCode.ASSET_NOT_FOUND
    });
  });
});
