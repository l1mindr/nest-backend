import { Roles } from '@features/security/decorators/roles.decorator';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ISyncAssetsUseCase,
  SYNC_ASSETS_USE_CASE
} from '../../application/interfaces/assets.interface';
import { ApiSyncAssets } from '../swagger/assets.swagger';

/**
 * Write-side of the asset catalogue: synchronises CoinGecko market data.
 *
 * Restricted to the owner and protected by the double-submit CSRF check. A
 * `RolesGuard` enforces `@Roles(UserRole.OWNER)` before the handler runs.
 */
@Controller({
  path: 'assets',
  version: '1'
})
@ApiTags(ApiTagName.ASSETS)
export class AssetSyncController {
  constructor(
    @Inject(SYNC_ASSETS_USE_CASE)
    private readonly syncAssetsUseCase: ISyncAssetsUseCase
  ) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER)
  @ApiSyncAssets()
  async syncAssets() {
    return this.syncAssetsUseCase.execute();
  }
}
