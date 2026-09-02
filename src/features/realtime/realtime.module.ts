import { TokenModule } from '@features/token/token.module';
import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './application/services/realtime.service';
import { REALTIME_EVENT_PUBLISHER } from './application/interfaces/realtime.interface';
import { RealtimeGateway } from './gateways/realtime.gateway';

// Global like RedisModule: PortfolioModule/CoinTrackerModule/SessionsModule
// inject REALTIME_EVENT_PUBLISHER without importing this module themselves.
// Doing otherwise would create a module cycle — this module imports
// TokenModule, which imports SessionsModule, so SessionsModule importing
// this module back would close the loop.
@Global()
@Module({
  imports: [TokenModule],
  providers: [
    RealtimeGateway,
    RealtimeService,
    { provide: REALTIME_EVENT_PUBLISHER, useExisting: RealtimeService }
  ],
  exports: [REALTIME_EVENT_PUBLISHER]
})
export class RealtimeModule {}
