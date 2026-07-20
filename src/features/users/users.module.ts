import { SessionsModule } from '@features/sessions/sessions.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './admin.users.controller';
import { User } from './entities/user.entity';
import { USER_SERVICE } from './interfaces/users.interface';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), SessionsModule],
  controllers: [UsersController, AdminUsersController],
  providers: [
    UsersService,
    { provide: USER_SERVICE, useExisting: UsersService }
  ],
  exports: [USER_SERVICE]
})
export class UsersModule {}
