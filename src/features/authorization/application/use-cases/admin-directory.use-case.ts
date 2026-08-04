import {
  decodeCursor,
  encodeCursor,
  isValidUUID
} from '@core/pagination/cursor.util';
import { paginate } from '@core/pagination/paginate.util';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import { ADMINS_PAGE_SIZE_DEFAULT } from '../../presentation/dto/request/admin-list.request.dto';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import { RoleHierarchy } from '../../domain/role-hierarchy';
import {
  ADMIN_PERMISSION_REPOSITORY,
  AdminAccount,
  IAdminDirectoryUseCase,
  IAdminPermissionRepository,
  IPermissionEvaluationService,
  PERMISSION_EVALUATION_SERVICE,
  PaginatedResult
} from '../interfaces/authorization.interface';

/**
 * Reads of the administrator directory.
 *
 * The listing resolves permissions for the whole page in a single batched query
 * rather than one per administrator, so adding administrators does not add
 * round trips.
 */
@Injectable()
export class AdminDirectoryUseCase implements IAdminDirectoryUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ADMIN_PERMISSION_REPOSITORY)
    private readonly adminPermissionRepository: IAdminPermissionRepository,
    @Inject(PERMISSION_EVALUATION_SERVICE)
    private readonly permissionEvaluation: IPermissionEvaluationService
  ) {}

  async list(
    cursor?: string,
    limit?: number
  ): Promise<PaginatedResult<AdminAccount>> {
    const take = limit ?? ADMINS_PAGE_SIZE_DEFAULT;
    const cursorId = this.parseCursor(cursor);

    const accounts = await this.userRepository.findUsersByRole(
      UserRole.ADMIN,
      cursorId,
      take + 1
    );

    const page = paginate(accounts, take, (account) =>
      encodeCursor(account.id)
    );

    const granted = await this.adminPermissionRepository.findByUserIds(
      page.items.map((account) => account.id)
    );

    return {
      items: page.items.map((account) => ({
        account,
        permissions: granted.get(account.id) ?? []
      })),
      nextCursor: page.nextCursor
    };
  }

  async findById(userId: string): Promise<AdminAccount> {
    const account = await this.userRepository.findUserForAdmin(userId);

    if (!account) throw UserErrors.userNotFound(userId);

    if (!RoleHierarchy.isAdministrative(account.role)) {
      throw AuthorizationErrors.notAnAdministrator(userId);
    }

    // Asked of the evaluation service rather than read straight from the grant
    // table, so that the owner is described the way they are actually treated:
    // holding everything, because they bypass evaluation.
    return {
      account,
      permissions:
        await this.permissionEvaluation.effectivePermissionsOf(account)
    };
  }

  private parseCursor(cursor?: string): string | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = decodeCursor(cursor);
    } catch {
      throw UserErrors.invalidCursor();
    }

    if (!isValidUUID(decoded)) {
      throw UserErrors.invalidCursor();
    }

    return decoded;
  }
}
