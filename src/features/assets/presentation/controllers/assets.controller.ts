import { IdDto } from '@presentation/dto/id.dto';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  GET_ASSET_USE_CASE,
  IGetAssetUseCase,
  IListAssetsUseCase,
  LIST_ASSETS_USE_CASE
} from '../../application/interfaces/assets.interface';
import { AssetMapper } from '../../application/mappers/asset.mapper';
import { AssetListRequestDto } from '../dto/request/asset-list.request.dto';
import { ApiGetAsset, ApiListAssets } from '../swagger/assets.swagger';

/**
 * Read-side of the supported-asset catalogue.
 *
 * Assets are the currencies themselves — independent of users, portfolios and
 * wallets — and are synchronised from CoinGecko rather than administered by
 * hand. `JwtGuard` is registered globally, so both routes require a valid
 * `access_token` cookie and nothing more.
 */
@Controller({
  path: 'assets',
  version: '1'
})
@ApiTags(ApiTagName.ASSETS)
export class AssetsController {
  constructor(
    @Inject(GET_ASSET_USE_CASE)
    private readonly getAssetUseCase: IGetAssetUseCase,
    @Inject(LIST_ASSETS_USE_CASE)
    private readonly listAssetsUseCase: IListAssetsUseCase,
    private readonly assetMapper: AssetMapper
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiListAssets()
  async listAssets(@Query() query: AssetListRequestDto) {
    const { items, nextCursor } = await this.listAssetsUseCase.execute({
      search: query.search,
      cursor: query.cursor,
      limit: query.limit
    });

    return {
      items: this.assetMapper.toResponseList(items),
      nextCursor
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiGetAsset()
  async getAsset(@Param() { id }: IdDto) {
    return this.assetMapper.toResponse(await this.getAssetUseCase.execute(id));
  }
}
