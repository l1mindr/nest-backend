import {
  decodeCursor,
  encodeCursor,
  isValidUUID
} from '@core/pagination/cursor.util';
import { paginate } from '@core/pagination/paginate.util';
import { Inject, Injectable } from '@nestjs/common';
import { AssetErrors } from '../../domain/errors/asset-errors';
import { ASSETS_PAGE_SIZE_DEFAULT } from '../../presentation/dto/request/asset-list.request.dto';
import {
  ASSET_REPOSITORY,
  IAssetRepository,
  IListAssetsUseCase
} from '../interfaces/assets.interface';

@Injectable()
export class ListAssetsUseCase implements IListAssetsUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository
  ) {}

  async execute(options: { search?: string; cursor?: string; limit?: number }) {
    const take = options.limit ?? ASSETS_PAGE_SIZE_DEFAULT;
    const cursorId = this.parseCursor(options.cursor);

    const assets = await this.assetRepository.list({
      search: options.search ?? '',
      cursorId,
      limit: take + 1
    });

    return paginate(assets, take, (asset) => encodeCursor(asset.id));
  }

  private parseCursor(cursor?: string): string | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = decodeCursor(cursor);
    } catch {
      throw AssetErrors.invalidCursor();
    }

    if (!isValidUUID(decoded)) {
      throw AssetErrors.invalidCursor();
    }

    return decoded;
  }
}
