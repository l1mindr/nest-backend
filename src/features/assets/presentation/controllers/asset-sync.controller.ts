import { Roles } from '@features/security/decorators/roles.decorator';
import { RateLimitPolicies } from '@features/security/rate-limit/config/rate-limit.config';
import { RateLimit } from '@features/security/rate-limit/decorators/rate-limit.decorator';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssetSyncProducer } from '../../infrastructure/queues/asset-sync.producer';
import { ApiSyncAssets } from '../swagger/assets.swagger';

/**
 * Write-side of the asset catalogue: schedules a CoinGecko market data
 * synchronization instead of performing it inline, so the request never sits
 * behind an external HTTP call.
 *
 * Restricted to the owner and protected by the double-submit CSRF check. A
 * `RolesGuard` enforces `@Roles(UserRole.OWNER)` before the handler runs, and a
 * rate limit bounds how often the shared catalogue can be rewritten.
 */
@Controller({
  path: 'assets',
  version: '1'
})
@ApiTags(ApiTagName.ASSETS)
export class AssetSyncController {
  constructor(private readonly assetSyncProducer: AssetSyncProducer) {}

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.OWNER)
  @RateLimit(RateLimitPolicies.Assets.Sync)
  @ApiSyncAssets()
  async syncAssets() {
    return this.assetSyncProducer.enqueueManualSync();
  }
}
