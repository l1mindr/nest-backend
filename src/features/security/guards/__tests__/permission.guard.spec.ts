import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { SecurityErrorCode } from '../../errors/security-error-code.enum';
import { PermissionGuard } from '../permission.guard';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn()
  };

  const mockPermissionEvaluation = {
    assertCan: jest.fn()
  };

  const contextFor = (user: unknown) =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) })
    }) as any;

  const admin = { id: 'admin-1', role: UserRole.ADMIN };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissionEvaluation.assertCan.mockResolvedValue(undefined);

    guard = new PermissionGuard(
      mockReflector as any,
      mockPermissionEvaluation as any
    );
  });

  it('should allow a route that declares no requirement, without evaluating', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextFor(admin))).resolves.toBe(true);
    expect(mockPermissionEvaluation.assertCan).not.toHaveBeenCalled();
  });

  it('should allow a route whose requirement list is empty', async () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);

    await expect(guard.canActivate(contextFor(admin))).resolves.toBe(true);
    expect(mockPermissionEvaluation.assertCan).not.toHaveBeenCalled();
  });

  it('should hand the decision to the evaluation service', async () => {
    mockReflector.getAllAndOverride.mockReturnValue([Permission.USER_READ]);

    await expect(guard.canActivate(contextFor(admin))).resolves.toBe(true);
    expect(mockPermissionEvaluation.assertCan).toHaveBeenCalledWith(admin, [
      Permission.USER_READ
    ]);
  });

  it('should propagate the refusal raised by the evaluation service', async () => {
    mockReflector.getAllAndOverride.mockReturnValue([Permission.USER_DELETE]);
    mockPermissionEvaluation.assertCan.mockRejectedValue(
      Object.assign(new Error('Access denied'), {
        code: SecurityErrorCode.ACCESS_DENIED
      })
    );

    await expect(guard.canActivate(contextFor(admin))).rejects.toThrow(
      expect.objectContaining({ code: SecurityErrorCode.ACCESS_DENIED })
    );
  });

  it('should deny a request that carries no authenticated role', async () => {
    mockReflector.getAllAndOverride.mockReturnValue([Permission.USER_READ]);

    await expect(guard.canActivate(contextFor(undefined))).rejects.toThrow(
      expect.objectContaining({
        code: SecurityErrorCode.ACCESS_DENIED,
        statusCode: 403
      })
    );

    expect(mockPermissionEvaluation.assertCan).not.toHaveBeenCalled();
  });
});
