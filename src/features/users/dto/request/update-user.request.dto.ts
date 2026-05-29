import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserRequestDto } from './create-user.request.dto';

export class UpdateUserRequestDto extends PartialType(
  OmitType(CreateUserRequestDto, ['password'] as const)
) {}
