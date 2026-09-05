import {
  decodeCursor,
  encodeCursor,
  isValidUUID
} from '@core/pagination/cursor.util';
import { paginate } from '@core/pagination/paginate.util';
import { Inject, Injectable } from '@nestjs/common';
import { Asset } from '../../domain/entities/asset.entity';
import { AssetErrors } from '../../domain/errors/asset-errors';
import { ASSETS_PAGE_SIZE_DEFAULT } from '../../presentation/dto/request/asset-list.request.dto';
import {
  ASSET_REPOSITORY,
  AssetListCursor,
  IAssetRepository,
  IListAssetsUseCase
} from '../interfaces/assets.interface';

/** Separates the rank and id halves of an encoded cursor; never in a UUID. */
const CURSOR_PART_SEPARATOR = ':';
/** Rank half of the cursor when the row it was produced from was unranked. */
const CURSOR_RANK_NULL = 'null';

@Injectable()
export class ListAssetsUseCase implements IListAssetsUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository
  ) {}

  async execute(options: { search?: string; cursor?: string; limit?: number }) {
    const take = options.limit ?? ASSETS_PAGE_SIZE_DEFAULT;
    const cursor = this.parseCursor(options.cursor);

    const assets = await this.assetRepository.list({
      search: options.search ?? '',
      cursor,
      limit: take + 1
    });

    return paginate(assets, take, (asset) => this.encodeAssetCursor(asset));
  }

  /**
   * The cursor encodes the ordering position (`marketCapRank`, `id`) that
   * `list()` sorts and paginates by — not just the id — so resuming after a
   * page stays consistent with the market-cap-rank order the endpoint returns.
   */
  private encodeAssetCursor(asset: Asset): string {
    const rank =
      asset.marketCapRank === null
        ? CURSOR_RANK_NULL
        : String(asset.marketCapRank);

    return encodeCursor(`${rank}${CURSOR_PART_SEPARATOR}${asset.id}`);
  }

  private parseCursor(cursor?: string): AssetListCursor | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = decodeCursor(cursor);
    } catch {
      throw AssetErrors.invalidCursor();
    }

    const separatorIndex = decoded.indexOf(CURSOR_PART_SEPARATOR);
    if (separatorIndex === -1) {
      throw AssetErrors.invalidCursor();
    }

    const rankPart = decoded.slice(0, separatorIndex);
    const idPart = decoded.slice(separatorIndex + 1);

    if (!isValidUUID(idPart)) {
      throw AssetErrors.invalidCursor();
    }

    if (rankPart === CURSOR_RANK_NULL) {
      return { marketCapRank: null, id: idPart };
    }

    const marketCapRank = Number(rankPart);
    if (!Number.isInteger(marketCapRank)) {
      throw AssetErrors.invalidCursor();
    }

    return { marketCapRank, id: idPart };
  }
}
