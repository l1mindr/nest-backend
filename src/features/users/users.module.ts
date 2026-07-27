import { SessionsModule } from '@features/sessions/sessions.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './admin.users.controller';
import { AdminUsersUseCase } from './application/use-cases/admin-users.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { DeleteAccountUseCase } from './application/use-cases/delete-account.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { UserQueryService } from './application/services/user-query.service';
import { UserMapper } from './application/mappers/user.mapper';
import { User } from './entities/user.entity';
import {
  ADMIN_USERS_USE_CASE,
  CREATE_USER_USE_CASE,
  DELETE_ACCOUNT_USE_CASE,
  UPDATE_PROFILE_USE_CASE,
  USER_QUERY_SERVICE,
  USER_REPOSITORY
} from './interfaces/users.interface';
import { UserRepository } from './repositories/user.repository';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), SessionsModule],
  controllers: [UsersController, AdminUsersController],
  providers: [
    UserRepository,
    { provide: USER_REPOSITORY, useExisting: UserRepository },
    UserQueryService,
    { provide: USER_QUERY_SERVICE, useExisting: UserQueryService },
    CreateUserUseCase,
    { provide: CREATE_USER_USE_CASE, useExisting: CreateUserUseCase },
    UpdateProfileUseCase,
    { provide: UPDATE_PROFILE_USE_CASE, useExisting: UpdateProfileUseCase },
    DeleteAccountUseCase,
    { provide: DELETE_ACCOUNT_USE_CASE, useExisting: DeleteAccountUseCase },
    AdminUsersUseCase,
    { provide: ADMIN_USERS_USE_CASE, useExisting: AdminUsersUseCase },
    UserMapper
  ],
  exports: [USER_REPOSITORY, CREATE_USER_USE_CASE, USER_QUERY_SERVICE]
})
export class UsersModule {}
