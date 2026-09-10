import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoDbModule } from '@infrastructure/logging/mongodb/mongodb.provider';
import { MONGODB_CONNECTION_NAME } from '@infrastructure/logging/mongodb/mongodb.constants';
import {
  LIST_USER_ACTIVITIES_USE_CASE,
  USER_ACTIVITY_RECORDER,
  USER_ACTIVITY_REPOSITORY
} from './application/interfaces/activity.interface';
import { UserActivityMapper } from './application/mappers/user-activity.mapper';
import { UserActivityRecorderService } from './application/services/user-activity-recorder.service';
import { ListUserActivitiesUseCase } from './application/use-cases/list-user-activities.use-case';
import { UserActivityRepository } from './infrastructure/repositories/user-activity.repository';
import {
  UserActivity,
  UserActivitySchema
} from './infrastructure/schemas/user-activity.schema';
import { UserActivityController } from './presentation/controllers/user-activity.controller';

/**
 * User-facing activity.
 *
 * `MongoDbModule` is imported rather than re-declared: Nest caches modules by
 * identity, so importing the same module here and from `LoggingModule` yields
 * one instance and therefore one connection. `user_activities` is a separate
 * collection on that shared connection — it does not touch `audit_logs`.
 *
 * `USER_ACTIVITY_RECORDER` is exported so feature modules can record after
 * their own operations succeed. It is exported deliberately rather than made
 * global: the modules that record activity are then visible in their own
 * import lists, instead of the dependency being invisible at every call site.
 */
@Module({
  imports: [
    MongoDbModule,
    MongooseModule.forFeature(
      [{ name: UserActivity.name, schema: UserActivitySchema }],
      MONGODB_CONNECTION_NAME
    )
  ],
  controllers: [UserActivityController],
  providers: [
    UserActivityMapper,
    {
      provide: USER_ACTIVITY_REPOSITORY,
      useClass: UserActivityRepository
    },
    {
      provide: USER_ACTIVITY_RECORDER,
      useClass: UserActivityRecorderService
    },
    {
      provide: LIST_USER_ACTIVITIES_USE_CASE,
      useClass: ListUserActivitiesUseCase
    }
  ],
  exports: [USER_ACTIVITY_RECORDER]
})
export class ActivityModule {}
