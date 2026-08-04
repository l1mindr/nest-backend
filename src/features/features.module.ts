import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { CoinTrackerModule } from './coin-tracker/coin-tracker.module';
import { SecurityModule } from './security/security.module';
import { SessionsModule } from './sessions/sessions.module';
import { TokenModule } from './token/token.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    CoinTrackerModule,
    SecurityModule,
    SessionsModule,
    TokenModule,
    UsersModule
  ]
})
export class FeaturesModule {}
