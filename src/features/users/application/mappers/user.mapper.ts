import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AdminUserResponseDto } from '../../dto/response/admin-user.response.dto';
import { User } from '../../entities/user.entity';

@Injectable()
export class UserMapper {
  toAdminList(users: User[]): AdminUserResponseDto[] {
    return plainToInstance(AdminUserResponseDto, users, {
      excludeExtraneousValues: true
    });
  }
}
