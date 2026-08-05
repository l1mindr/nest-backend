import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { RoleHierarchy } from '../role-hierarchy';

describe('RoleHierarchy', () => {
  describe('satisfies', () => {
    it('should let the owner satisfy every tier', () => {
      expect(RoleHierarchy.satisfies(UserRole.OWNER, UserRole.OWNER)).toBe(
        true
      );
      expect(RoleHierarchy.satisfies(UserRole.OWNER, UserRole.ADMIN)).toBe(
        true
      );
      expect(RoleHierarchy.satisfies(UserRole.OWNER, UserRole.USER)).toBe(true);
    });

    it('should not let an administrator satisfy the owner tier', () => {
      expect(RoleHierarchy.satisfies(UserRole.ADMIN, UserRole.OWNER)).toBe(
        false
      );
    });

    it('should let an administrator satisfy its own tier and below', () => {
      expect(RoleHierarchy.satisfies(UserRole.ADMIN, UserRole.ADMIN)).toBe(
        true
      );
      expect(RoleHierarchy.satisfies(UserRole.ADMIN, UserRole.USER)).toBe(true);
    });

    it('should not let a user satisfy any administrative tier', () => {
      expect(RoleHierarchy.satisfies(UserRole.USER, UserRole.ADMIN)).toBe(
        false
      );
      expect(RoleHierarchy.satisfies(UserRole.USER, UserRole.OWNER)).toBe(
        false
      );
    });
  });

  describe('bypassesAuthorization', () => {
    it('should be true only for the owner', () => {
      expect(RoleHierarchy.bypassesAuthorization(UserRole.OWNER)).toBe(true);
      expect(RoleHierarchy.bypassesAuthorization(UserRole.ADMIN)).toBe(false);
      expect(RoleHierarchy.bypassesAuthorization(UserRole.USER)).toBe(false);
    });
  });

  describe('isAdministrative', () => {
    it('should count the owner and administrators, but not users', () => {
      expect(RoleHierarchy.isAdministrative(UserRole.OWNER)).toBe(true);
      expect(RoleHierarchy.isAdministrative(UserRole.ADMIN)).toBe(true);
      expect(RoleHierarchy.isAdministrative(UserRole.USER)).toBe(false);
    });
  });
});
