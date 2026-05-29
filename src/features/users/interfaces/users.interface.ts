import { CreateUserRequestDto } from '../dto/request/create-user.request.dto';
import { UpdateUserRequestDto } from '../dto/request/update-user.request.dto';
import { User } from '../entities/user.entity';

export interface IUsersService {
  register(dto: CreateUserRequestDto): Promise<void>;
  list(): Promise<User[]>;
  findByIdentifierForAuth(identifier: string): Promise<User | null>;
  findByIdForSessionValidation(userId: string): Promise<User | null>;
  findByIdWithPassword(userId: string): Promise<User | null>;
  updateProfile(
    userId: string,
    updateUserRequestDto: UpdateUserRequestDto
  ): Promise<void>;
  setPassword(userid: string, hashPassword: string): Promise<void>;
  requestAccountDeletion(userId: string): Promise<void>;
}
