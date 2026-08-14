import { Inject, Injectable } from '@nestjs/common';
import { Asset } from '../../domain/entities/asset.entity';
import { AssetErrors } from '../../domain/errors/asset-errors';
import {
  ASSET_REPOSITORY,
  IAssetRepository,
  IGetAssetUseCase
} from '../interfaces/assets.interface';

@Injectable()
export class GetAssetUseCase implements IGetAssetUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository
  ) {}

  async execute(assetId: string): Promise<Asset> {
    const asset = await this.assetRepository.findById(assetId);

    if (!asset) throw AssetErrors.assetNotFound(assetId);

    return asset;
  }
}
