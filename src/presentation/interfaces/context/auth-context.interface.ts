import { UserRole } from '@features/users/domain/enums/user-role.enum';

export interface AuthUser {
  readonly id: string;
  readonly role: UserRole;
}

export interface AuthSession {
  readonly id: string;
}
