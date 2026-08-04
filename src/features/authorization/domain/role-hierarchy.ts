import { UserRole } from '@features/users/domain/enums/user-role.enum';

/**
 * The three role tiers, ranked. The hierarchy is a structural property of the
 * security model rather than configuration, so it lives in code: a tier that
 * could be reordered at runtime would let a data change grant privilege.
 *
 * Granularity *within* a tier is the job of permissions, which are data. A
 * future `SUPPORT_ADMIN` is a new member at rank {@link ADMIN_RANK} whose reach
 * is decided entirely by the permissions granted to it — no call site changes.
 */
const ADMIN_RANK = 20;

const RANK: Readonly<Record<UserRole, number>> = {
  [UserRole.OWNER]: 30,
  [UserRole.ADMIN]: ADMIN_RANK,
  [UserRole.USER]: 10
};

export class RoleHierarchy {
  /**
   * Whether `role` reaches at least `minimum`. `OWNER` therefore satisfies an
   * `ADMIN` requirement, which is what stops "owner can do everything" from
   * being restated at every call site.
   */
  static satisfies(role: UserRole, minimum: UserRole): boolean {
    return RANK[role] >= RANK[minimum];
  }

  /**
   * The one place the owner short-circuit is expressed. Callers ask this rather
   * than comparing to `UserRole.OWNER`, so the rule has a single owner and a
   * single place to change.
   */
  static bypassesAuthorization(role: UserRole): boolean {
    return role === UserRole.OWNER;
  }

  /** Whether the role is an administrative tier, owner included. */
  static isAdministrative(role: UserRole): boolean {
    return RANK[role] >= ADMIN_RANK;
  }
}
