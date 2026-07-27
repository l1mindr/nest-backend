import { SessionsModule } from '@features/sessions/sessions.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './admin.users.controller';
import { AdminUsersService } from './application/admin/admin-users.service';
import { CreateUserService } from './application/create/create-user.service';
import { DeleteAccountService } from './application/deletion/delete-account.service';
import { UserQueryService } from './application/query/user-query.service';
import { UpdateProfileService } from './application/update/update-profile.service';
import { User } from './entities/user.entity';
import {
  ADMIN_USERS_SERVICE,
  CREATE_USER_SERVICE,
  DELETE_ACCOUNT_SERVICE,
  UPDATE_PROFILE_SERVICE,
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
    CreateUserService,
    { provide: CREATE_USER_SERVICE, useExisting: CreateUserService },
    UpdateProfileService,
    { provide: UPDATE_PROFILE_SERVICE, useExisting: UpdateProfileService },
    DeleteAccountService,
    { provide: DELETE_ACCOUNT_SERVICE, useExisting: DeleteAccountService },
    AdminUsersService,
    { provide: ADMIN_USERS_SERVICE, useExisting: AdminUsersService }
  ],
  exports: [USER_REPOSITORY, CREATE_USER_SERVICE, USER_QUERY_SERVICE]
})
export class UsersModule {}
