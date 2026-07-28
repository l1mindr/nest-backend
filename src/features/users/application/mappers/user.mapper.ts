import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AdminUserResponseDto } from '../../presentation/dto/response/admin-user.response.dto';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class UserMapper {
  toAdminList(users: User[]): AdminUserResponseDto[] {
    return plainToInstance(AdminUserResponseDto, users, {
      excludeExtraneousValues: true
    });
  }
}
