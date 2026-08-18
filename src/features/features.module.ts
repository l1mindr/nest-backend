import { Module } from '@nestjs/common';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { CoinTrackerModule } from './coin-tracker/coin-tracker.module';
import { LogsModule } from './logs/logs.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { SecurityModule } from './security/security.module';
import { SessionsModule } from './sessions/sessions.module';
import { TokenModule } from './token/token.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AssetsModule,
    AuthModule,
    AuthorizationModule,
    CoinTrackerModule,
    LogsModule,
    PortfolioModule,
    SecurityModule,
    SessionsModule,
    TokenModule,
    UsersModule
  ]
})
export class FeaturesModule {}
