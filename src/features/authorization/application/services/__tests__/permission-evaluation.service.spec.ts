import { SecurityErrorCode } from '@features/security/errors/security-error-code.enum';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import {
  ALL_PERMISSIONS,
  Permission
} from '../../../domain/enums/permission.enum';
import {
  DELEGABLE_PERMISSIONS,
  isOwnerOnly
} from '../../../domain/permission.catalog';
import { PermissionEvaluationService } from '../permission-evaluation.service';

describe('PermissionEvaluationService', () => {
  let service: PermissionEvaluationService;

  const mockAdminPermissionRepository = {
    findByUserId: jest.fn()
  };

  const mockUserRoleRepository = {
    permissionsForUser: jest.fn()
  };

  const owner = { id: 'owner-1', role: UserRole.OWNER };
  const admin = { id: 'admin-1', role: UserRole.ADMIN };
  const user = { id: 'user-1', role: UserRole.USER };

  /** The archetypes from the authorization model, as permission sets. */
  const SUPPORT_ADMIN = [Permission.USER_READ, Permission.USER_UPDATE];
  const MODERATOR = [Permission.USER_READ, Permission.USER_SUSPEND];
  const READ_ONLY = [Permission.USER_READ];

  beforeEach(() => {
    jest.clearAllMocks();

    // No role assigns anything unless a test says otherwise, so the existing
    // direct-grant-only coverage keeps exercising exactly what it always has.
    mockUserRoleRepository.permissionsForUser.mockResolvedValue([]);

    service = new PermissionEvaluationService(
      mockAdminPermissionRepository as any,
      mockUserRoleRepository as any
    );
  });

  describe('owner bypass', () => {
    it('should allow the owner without consulting the grant table', async () => {
      await expect(
        service.can(owner, [Permission.SYSTEM_SETTINGS])
      ).resolves.toBe(true);

      expect(mockAdminPermissionRepository.findByUserId).not.toHaveBeenCalled();
      expect(mockUserRoleRepository.permissionsForUser).not.toHaveBeenCalled();
    });

    it('should allow the owner every permission at once', async () => {
      await expect(service.can(owner, ALL_PERMISSIONS)).resolves.toBe(true);
    });

    it('should report the owner as holding every permission', async () => {
      await expect(service.effectivePermissionsOf(owner)).resolves.toEqual([
        ...ALL_PERMISSIONS
      ]);

      expect(mockAdminPermissionRepository.findByUserId).not.toHaveBeenCalled();
      expect(mockUserRoleRepository.permissionsForUser).not.toHaveBeenCalled();
    });

    it('should never throw for the owner', async () => {
      await expect(
        service.assertCan(owner, [Permission.USER_DELETE])
      ).resolves.toBeUndefined();
    });
  });

  describe('administrator permission evaluation', () => {
    it('should grant access when the permission is held', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(MODERATOR);

      await expect(service.can(admin, [Permission.USER_SUSPEND])).resolves.toBe(
        true
      );
    });

    it('should deny access when the permission is not held', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(READ_ONLY);

      await expect(service.can(admin, [Permission.USER_SUSPEND])).resolves.toBe(
        false
      );
    });

    it('should deny an administrator holding nothing at all', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([]);

      await expect(service.can(admin, [Permission.USER_READ])).resolves.toBe(
        false
      );
    });

    it('should require every listed permission, not merely one', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(READ_ONLY);

      await expect(
        service.can(admin, [Permission.USER_READ, Permission.USER_DELETE])
      ).resolves.toBe(false);
    });

    it('should allow a route that declares no requirement', async () => {
      await expect(service.can(admin, [])).resolves.toBe(true);

      expect(mockAdminPermissionRepository.findByUserId).not.toHaveBeenCalled();
    });

    it('should report exactly the permissions granted', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(
        SUPPORT_ADMIN
      );

      await expect(service.effectivePermissionsOf(admin)).resolves.toEqual(
        SUPPORT_ADMIN
      );
    });
  });

  describe('administrator archetypes', () => {
    it('should let a read-only administrator read but not suspend', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(READ_ONLY);

      await expect(service.can(admin, [Permission.USER_READ])).resolves.toBe(
        true
      );
      await expect(service.can(admin, [Permission.USER_SUSPEND])).resolves.toBe(
        false
      );
      await expect(service.can(admin, [Permission.USER_UPDATE])).resolves.toBe(
        false
      );
    });

    it('should let a support administrator read and update but not suspend', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(
        SUPPORT_ADMIN
      );

      await expect(service.can(admin, [Permission.USER_READ])).resolves.toBe(
        true
      );
      await expect(service.can(admin, [Permission.USER_UPDATE])).resolves.toBe(
        true
      );
      await expect(service.can(admin, [Permission.USER_SUSPEND])).resolves.toBe(
        false
      );
    });

    it('should let a moderator read and suspend but not update', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(MODERATOR);

      await expect(service.can(admin, [Permission.USER_READ])).resolves.toBe(
        true
      );
      await expect(service.can(admin, [Permission.USER_SUSPEND])).resolves.toBe(
        true
      );
      await expect(service.can(admin, [Permission.USER_UPDATE])).resolves.toBe(
        false
      );
    });

    it('should let a super administrator do everything delegable', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        ...DELEGABLE_PERMISSIONS
      ]);

      await expect(service.can(admin, DELEGABLE_PERMISSIONS)).resolves.toBe(
        true
      );
    });

    /**
     * The reservation is enforced at evaluation, not only at the write paths.
     * An `ADMIN_*` row inserted by hand, by a migration slip or by a future bug
     * still buys nothing — which is what makes owner-only administration a
     * property of the model rather than of the grant endpoints.
     */
    it.each(ALL_PERMISSIONS.filter(isOwnerOnly))(
      'should refuse %s even when the grant table says the administrator holds it',
      async (reserved) => {
        mockAdminPermissionRepository.findByUserId.mockResolvedValue([
          ...ALL_PERMISSIONS
        ]);

        await expect(service.can(admin, [reserved])).resolves.toBe(false);
      }
    );

    it('should refuse a mixed requirement containing a reserved permission', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        ...ALL_PERMISSIONS
      ]);

      await expect(
        service.can(admin, [Permission.USER_READ, Permission.ADMIN_READ])
      ).resolves.toBe(false);
    });

    it('should not report a reserved permission as effectively held', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        ...ALL_PERMISSIONS
      ]);

      const effective = await service.effectivePermissionsOf(admin);

      expect(effective.filter(isOwnerOnly)).toEqual([]);
    });
  });

  describe('role-derived permissions', () => {
    it('should grant access from a role alone, with no direct grant', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([]);
      mockUserRoleRepository.permissionsForUser.mockResolvedValue(READ_ONLY);

      await expect(service.can(admin, [Permission.USER_READ])).resolves.toBe(
        true
      );
    });

    it('should union a direct grant with a role grant', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        Permission.USER_SUSPEND
      ]);
      mockUserRoleRepository.permissionsForUser.mockResolvedValue([
        Permission.USER_READ
      ]);

      await expect(
        service.can(admin, [Permission.USER_READ, Permission.USER_SUSPEND])
      ).resolves.toBe(true);
    });

    it('should not duplicate a permission held both directly and through a role', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        Permission.USER_READ
      ]);
      mockUserRoleRepository.permissionsForUser.mockResolvedValue([
        Permission.USER_READ
      ]);

      const effective = await service.effectivePermissionsOf(admin);

      expect(effective).toEqual([Permission.USER_READ]);
    });

    it('should still deny when neither source grants the permission', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        Permission.USER_READ
      ]);
      mockUserRoleRepository.permissionsForUser.mockResolvedValue([
        Permission.USER_SUSPEND
      ]);

      await expect(service.can(admin, [Permission.USER_UPDATE])).resolves.toBe(
        false
      );
    });

    it('should refuse an owner-only permission even if a role somehow granted it', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([]);
      mockUserRoleRepository.permissionsForUser.mockResolvedValue([
        Permission.ADMIN_READ
      ]);

      await expect(service.can(admin, [Permission.ADMIN_READ])).resolves.toBe(
        false
      );
    });
  });

  describe('ordinary users', () => {
    it('should deny a user holding no grants', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([]);

      await expect(service.can(user, [Permission.USER_READ])).resolves.toBe(
        false
      );
    });

    it('should report an empty permission set for a user', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([]);

      await expect(service.effectivePermissionsOf(user)).resolves.toEqual([]);
    });
  });

  describe('assertCan', () => {
    it('should raise ACCESS_DENIED when the permission is missing', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(READ_ONLY);

      await expect(
        service.assertCan(admin, [Permission.USER_DELETE])
      ).rejects.toThrow(
        expect.objectContaining({
          code: SecurityErrorCode.ACCESS_DENIED,
          statusCode: 403
        })
      );
    });

    it('should not disclose which permission was missing', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([]);

      await expect(
        service.assertCan(admin, [Permission.SYSTEM_SETTINGS])
      ).rejects.toThrow(expect.objectContaining({ metadata: undefined }));
    });

    it('should pass silently when the permission is held', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue(MODERATOR);

      await expect(
        service.assertCan(admin, [Permission.USER_SUSPEND])
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanDelegate', () => {
    it('should refuse to pass on a permission the caller does not hold', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        Permission.ROLE_ASSIGN
      ]);

      await expect(
        service.assertCanDelegate(admin, [Permission.SYSTEM_SETTINGS])
      ).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.PERMISSION_NOT_HELD,
          statusCode: 403,
          metadata: { permissions: [Permission.SYSTEM_SETTINGS] }
        })
      );
    });

    it('should name every permission the caller was missing', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        Permission.USER_READ
      ]);

      await expect(
        service.assertCanDelegate(admin, [
          Permission.USER_READ,
          Permission.USER_DELETE,
          Permission.AUDIT_READ
        ])
      ).rejects.toThrow(
        expect.objectContaining({
          metadata: {
            permissions: [Permission.USER_DELETE, Permission.AUDIT_READ]
          }
        })
      );
    });

    it('should allow passing on a permission the caller holds', async () => {
      mockAdminPermissionRepository.findByUserId.mockResolvedValue([
        Permission.ROLE_ASSIGN,
        Permission.USER_SUSPEND
      ]);

      await expect(
        service.assertCanDelegate(admin, [Permission.USER_SUSPEND])
      ).resolves.toBeUndefined();
    });

    it('should let the owner delegate anything delegable', async () => {
      await expect(
        service.assertCanDelegate(owner, DELEGABLE_PERMISSIONS)
      ).resolves.toBeUndefined();

      expect(mockAdminPermissionRepository.findByUserId).not.toHaveBeenCalled();
    });

    /**
     * Refused for the owner too. The reservation is not "only the owner may
     * hand this out" but "no account other than the owner may ever hold it",
     * so there is nobody it could legitimately be given to.
     */
    it.each(ALL_PERMISSIONS.filter(isOwnerOnly))(
      'should refuse to delegate %s even for the owner',
      async (reserved) => {
        await expect(
          service.assertCanDelegate(owner, [reserved])
        ).rejects.toThrow(
          expect.objectContaining({
            code: AuthorizationErrorCode.PERMISSION_RESERVED_TO_OWNER
          })
        );
      }
    );
  });
});
