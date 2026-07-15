import { CreateUserRequestDto } from '../dto/request/create-user.request.dto';
import { UpdateProfileRequestDto } from '../dto/request/update-profile.request.dto';
import { User } from '../entities/user.entity';

export const USER_SERVICE = Symbol('IUsersService');

export interface IUsersService {
  register(dto: CreateUserRequestDto): Promise<void>;
  listForAdmin(): Promise<User[]>;
  findByIdForAdmin(id: string): Promise<User>;
  findByIdentifierForAuth(identifier: string): Promise<User | null>;
  findByIdForSessionValidation(userId: string): Promise<User | null>;
  findByIdWithPassword(userId: string): Promise<User | null>;
  findById(id: string): Promise<User>;
  updateProfile(
    userId: string,
    updateUserRequestDto: UpdateProfileRequestDto
  ): Promise<void>;
  setPassword(userid: string, hashPassword: string): Promise<void>;
  requestAccountDeletion(userId: string): Promise<void>;
}
