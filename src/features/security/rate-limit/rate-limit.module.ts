import { Module } from '@nestjs/common';
import { SecurityHashingModule } from '../hashing/security-hashing.module';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { CustomKeyResolver } from './resolvers/custom-key.resolver';
import { DeviceIdResolver } from './resolvers/device-id.resolver';
import { EmailResolver } from './resolvers/email.resolver';
import { IpResolver } from './resolvers/ip.resolver';
import {
  IRateLimitIdentifierResolver,
  RATE_LIMIT_RESOLVERS
} from './resolvers/rate-limit-resolver.interface';
import { RateLimitResolverRegistry } from './resolvers/rate-limit-resolver.registry';
import { RouteResolver } from './resolvers/route.resolver';
import { SessionIdResolver } from './resolvers/session-id.resolver';
import { UserIdResolver } from './resolvers/user-id.resolver';
import { UsernameResolver } from './resolvers/username.resolver';
import { VerificationCodeResolver } from './resolvers/verification-code.resolver';
import { RateLimitEvaluatorService } from './services/rate-limit-evaluator.service';
import { RateLimitKeyBuilder } from './services/rate-limit-key.builder';
import { RateLimitLogService } from './services/rate-limit-log.service';
import { RateLimitStoreService } from './services/rate-limit-store.service';
import {
  RATE_LIMIT_SERVICE,
  RateLimitService
} from './services/rate-limit.service';

/**
 * The registered identifier resolvers. Adding a dimension means adding an enum
 * member, a resolver class, and one entry here — no existing resolver or
 * service changes. Nest has no multi-provider, so this array is the
 * registration point.
 */
const RESOLVERS = [
  IpResolver,
  DeviceIdResolver,
  UserIdResolver,
  SessionIdResolver,
  EmailResolver,
  UsernameResolver,
  VerificationCodeResolver,
  RouteResolver,
  CustomKeyResolver
];

@Module({
  imports: [SecurityHashingModule],

  providers: [
    ...RESOLVERS,
    {
      provide: RATE_LIMIT_RESOLVERS,
      useFactory: (...resolvers: IRateLimitIdentifierResolver[]) => resolvers,
      inject: RESOLVERS
    },
    RateLimitResolverRegistry,
    RateLimitKeyBuilder,
    RateLimitStoreService,
    RateLimitLogService,
    RateLimitService,
    { provide: RATE_LIMIT_SERVICE, useExisting: RateLimitService },
    RateLimitEvaluatorService,
    RateLimitGuard
  ],

  // The guard is exported rather than registered as APP_GUARD here, so the
  // security module can place it in an explicit order relative to the other
  // global guards. The key builder is exported for e2e helpers that need to
  // compute a key without duplicating the hashing rules.
  exports: [RATE_LIMIT_SERVICE, RateLimitGuard, RateLimitKeyBuilder]
})
export class RateLimitModule {}
