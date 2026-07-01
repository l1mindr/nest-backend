import { UserRole } from '@features/users/enums/user-role.enum';
import { TestUser } from './user.types';

export type LoginIdentifier = 'email' | 'username';

export type AuthenticatedOptions = {
  loginBy?: LoginIdentifier;
  overrides?: Partial<TestUser>;
  withRole?: UserRole;
};
