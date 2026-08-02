import { PartialType, PickType } from '@nestjs/swagger';
import { CreateUserRequestDto } from './create-user.request.dto';

/**
 * Body of `PUT /v1/user`.
 *
 * Only the display name is editable. Email and username are immutable, and
 * the password is changed through `POST /v1/auth/change-password`, which
 * additionally requires the current one.
 */
export class UpdateProfileRequestDto extends PartialType(
  PickType(CreateUserRequestDto, ['name'] as const)
) {}
