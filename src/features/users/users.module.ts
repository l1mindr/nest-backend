import { SessionsModule } from '@features/sessions/sessions.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './admin.users.controller';
import { User } from './entities/user.entity';
import {
  CREATE_USER_SERVICE,
  DELETE_ACCOUNT_SERVICE,
  FIND_USER_ADMIN_SERVICE,
  LIST_USERS_ADMIN_SERVICE,
  UPDATE_PROFILE_SERVICE,
  USER_REPOSITORY
} from './interfaces/users.interface';
import { CreateUserService } from './services/create-user.service';
import { DeleteAccountService } from './services/delete-account.service';
import { FindUserAdminService } from './services/find-user-admin.service';
import { ListUsersAdminService } from './services/list-users-admin.service';
import { UpdateProfileService } from './services/update-profile.service';
import { UserRepository } from './services/user.repository';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), SessionsModule],
  controllers: [UsersController, AdminUsersController],
  providers: [
    UserRepository,
    { provide: USER_REPOSITORY, useExisting: UserRepository },
    CreateUserService,
    { provide: CREATE_USER_SERVICE, useExisting: CreateUserService },
    UpdateProfileService,
    { provide: UPDATE_PROFILE_SERVICE, useExisting: UpdateProfileService },
    DeleteAccountService,
    { provide: DELETE_ACCOUNT_SERVICE, useExisting: DeleteAccountService },
    ListUsersAdminService,
    { provide: LIST_USERS_ADMIN_SERVICE, useExisting: ListUsersAdminService },
    FindUserAdminService,
    { provide: FIND_USER_ADMIN_SERVICE, useExisting: FindUserAdminService }
  ],
  exports: [USER_REPOSITORY, CREATE_USER_SERVICE]
})
export class UsersModule {}
