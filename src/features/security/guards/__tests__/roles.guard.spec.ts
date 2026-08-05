import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { SecurityErrorCode } from '../../errors/security-error-code.enum';
import { RolesGuard } from '../roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn()
  };

  const contextFor = (user: unknown) =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) })
    }) as any;

  const owner = { id: 'owner-1', role: UserRole.OWNER };
  const admin = { id: 'admin-1', role: UserRole.ADMIN };
  const user = { id: 'user-1', role: UserRole.USER };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(mockReflector as any);
  });

  it('should allow a route with no role metadata', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextFor(user))).toBe(true);
  });

  it('should let the owner through a route reserved to the owner', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.OWNER]);

    expect(guard.canActivate(contextFor(owner))).toBe(true);
  });

  /** Rank, not equality: "the owner can do everything" is stated once. */
  it('should let the owner through a route demanding ADMIN', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(contextFor(owner))).toBe(true);
  });

  it('should refuse an administrator on a route reserved to the owner', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.OWNER]);

    expect(() => guard.canActivate(contextFor(admin))).toThrow(
      expect.objectContaining({
        code: SecurityErrorCode.ACCESS_DENIED,
        statusCode: 403
      })
    );
  });

  it('should refuse an ordinary user on a route reserved to the owner', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.OWNER]);

    expect(() => guard.canActivate(contextFor(user))).toThrow(
      expect.objectContaining({ code: SecurityErrorCode.ACCESS_DENIED })
    );
  });

  it('should refuse an ordinary user on a route demanding ADMIN', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(contextFor(user))).toThrow(
      expect.objectContaining({ code: SecurityErrorCode.ACCESS_DENIED })
    );
  });

  it('should deny a request that carries no authenticated role', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      expect.objectContaining({ code: SecurityErrorCode.ACCESS_DENIED })
    );
  });
});
