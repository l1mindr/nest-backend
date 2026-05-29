import { CreateUserRequestDto } from '../dto/request/create-user.request.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';

export interface IUsersService {
  register(dto: CreateUserRequestDto): Promise<void>;
  list(): Promise<User[]>;
  findByIdentifierForAuth(identifier: string): Promise<User | null>;
  findByIdForSessionValidation(userId: string): Promise<User | null>;
  findByIdWithPassword(userId: string): Promise<User | null>;
  updateProfile(userId: string, updateUserDto: UpdateUserDto): Promise<void>;
  setPassword(userid: string, hashPassword: string): Promise<void>;
  requestAccountDeletion(userId: string): Promise<void>;
}
