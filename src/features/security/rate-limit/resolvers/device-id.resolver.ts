import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

@Injectable()
export class DeviceIdResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.DEVICE;

  /**
   * Populated by the device middleware, which runs ahead of every guard.
   *
   * Reads `deviceId` — the client header when one was supplied, otherwise the
   * server-derived value. `derivedDeviceId` is carried alongside it on the
   * context, so re-pointing this dimension at the unspoofable value later is a
   * one-line change with no data migration.
   */
  resolve({ request }: RateLimitResolutionContext): string | null {
    return request.device?.deviceId ?? null;
  }
}
