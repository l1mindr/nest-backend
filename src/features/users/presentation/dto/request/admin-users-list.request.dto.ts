import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const ADMIN_USERS_PAGE_SIZE_DEFAULT = 20;
const ADMIN_USERS_PAGE_SIZE_MAX = 100;

export { ADMIN_USERS_PAGE_SIZE_DEFAULT, ADMIN_USERS_PAGE_SIZE_MAX };

export class AdminUsersListRequestDto {
  @ApiPropertyOptional(cursorQueryDocs())
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: ADMIN_USERS_PAGE_SIZE_DEFAULT,
      max: ADMIN_USERS_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_USERS_PAGE_SIZE_MAX)
  limit?: number;
}
