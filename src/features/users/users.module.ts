import { SessionsModule } from '@features/sessions/sessions.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './presentation/controllers/admin.users.controller';
import { AdminUsersUseCase } from './application/use-cases/admin-users.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { DeleteAccountUseCase } from './application/use-cases/delete-account.use-case';
import { InitiateRegistrationUseCase } from './application/use-cases/initiate-registration.use-case';
import { ResendVerificationUseCase } from './application/use-cases/resend-verification.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { UserQueryService } from './application/services/user-query.service';
import { VerificationCodeService } from './application/services/verification-code.service';
import { UserMapper } from './application/mappers/user.mapper';
import { User } from './domain/entities/user.entity';
import { UserVerificationCode } from './domain/entities/user-verification-code.entity';
import {
  ADMIN_USERS_USE_CASE,
  CREATE_USER_USE_CASE,
  DELETE_ACCOUNT_USE_CASE,
  INITIATE_REGISTRATION_USE_CASE,
  RESEND_VERIFICATION_USE_CASE,
  UPDATE_PROFILE_USE_CASE,
  USER_QUERY_SERVICE,
  USER_REPOSITORY,
  VERIFICATION_CODE_REPOSITORY,
  VERIFY_EMAIL_USE_CASE
} from './application/interfaces/users.interface';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { VerificationCodeRepository } from './infrastructure/repositories/verification-code.repository';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserVerificationCode]),
    SessionsModule
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [
    UserRepository,
    { provide: USER_REPOSITORY, useExisting: UserRepository },
    VerificationCodeRepository,
    {
      provide: VERIFICATION_CODE_REPOSITORY,
      useExisting: VerificationCodeRepository
    },
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
    InitiateRegistrationUseCase,
    {
      provide: INITIATE_REGISTRATION_USE_CASE,
      useExisting: InitiateRegistrationUseCase
    },
    ResendVerificationUseCase,
    {
      provide: RESEND_VERIFICATION_USE_CASE,
      useExisting: ResendVerificationUseCase
    },
    VerifyEmailUseCase,
    {
      provide: VERIFY_EMAIL_USE_CASE,
      useExisting: VerifyEmailUseCase
    },
    VerificationCodeService,
    UserMapper
  ],
  exports: [
    USER_REPOSITORY,
    CREATE_USER_USE_CASE,
    USER_QUERY_SERVICE,
    VERIFICATION_CODE_REPOSITORY,
    INITIATE_REGISTRATION_USE_CASE,
    RESEND_VERIFICATION_USE_CASE
  ]
})
export class UsersModule {}
