import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const ADMINS_PAGE_SIZE_DEFAULT = 20;
const ADMINS_PAGE_SIZE_MAX = 100;

export { ADMINS_PAGE_SIZE_DEFAULT, ADMINS_PAGE_SIZE_MAX };

export class AdminListRequestDto {
  @ApiPropertyOptional(cursorQueryDocs())
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: ADMINS_PAGE_SIZE_DEFAULT,
      max: ADMINS_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMINS_PAGE_SIZE_MAX)
  limit?: number;
}
