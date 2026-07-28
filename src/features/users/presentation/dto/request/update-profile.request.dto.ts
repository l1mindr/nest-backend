import { PartialType, PickType } from '@nestjs/swagger';
import { CreateUserRequestDto } from './create-user.request.dto';

export class UpdateProfileRequestDto extends PartialType(
  PickType(CreateUserRequestDto, ['name'] as const)
) {}
