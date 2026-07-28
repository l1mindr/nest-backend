import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const ADMIN_USERS_PAGE_SIZE_DEFAULT = 20;
const ADMIN_USERS_PAGE_SIZE_MAX = 100;

export { ADMIN_USERS_PAGE_SIZE_DEFAULT, ADMIN_USERS_PAGE_SIZE_MAX };

export class AdminUsersListRequestDto {
  @ApiPropertyOptional({
    description:
      'Opaque cursor obtained from a previous response. Omit to start from the beginning.',
    example: undefined
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: `Number of items to return per page (1–${ADMIN_USERS_PAGE_SIZE_MAX}). Defaults to ${ADMIN_USERS_PAGE_SIZE_DEFAULT}.`,
    minimum: 1,
    maximum: ADMIN_USERS_PAGE_SIZE_MAX,
    default: ADMIN_USERS_PAGE_SIZE_DEFAULT,
    example: ADMIN_USERS_PAGE_SIZE_DEFAULT
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_USERS_PAGE_SIZE_MAX)
  limit?: number;
}
