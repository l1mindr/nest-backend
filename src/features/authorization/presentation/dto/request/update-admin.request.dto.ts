import { CreateUserRequestDto } from '@features/users/presentation/dto/request/create-user.request.dto';
import { PartialType, PickType } from '@nestjs/swagger';

/**
 * Body of `PATCH /v1/admin/admins/{id}`.
 *
 * Editable surface is deliberately the same as the self-service profile: only
 * the display name. Email and username stay immutable, and the password is
 * never settable by another account — an administrator who could rewrite a
 * colleague's credentials would be able to take over that account outright.
 */
export class UpdateAdminRequestDto extends PartialType(
  PickType(CreateUserRequestDto, ['name'] as const)
) {}
