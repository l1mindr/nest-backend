import { plainToInstance } from 'class-transformer';
import { AdminUserResponseDto } from '../../dto/response/admin-user.response.dto';
import { User } from '../../entities/user.entity';

export class UserMapper {
  static toAdminList(users: User[]): AdminUserResponseDto[] {
    return plainToInstance(AdminUserResponseDto, users, {
      excludeExtraneousValues: true
    });
  }
}
