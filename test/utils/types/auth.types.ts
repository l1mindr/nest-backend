import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { TestUser } from './user.types';

export type LoginIdentifier = 'email' | 'username';

export type AuthenticatedOptions = {
  loginBy?: LoginIdentifier;
  overrides?: Partial<TestUser>;
  withRole?: UserRole;
  /**
   * Permissions to grant when `withRole` is `ADMIN`. Omit for an administrator
   * holding every permission, which is what specs unconcerned with
   * authorization want; pass an explicit list to model a narrowly-scoped one.
   */
  withPermissions?: Permission[];
};
