import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const SESSION_PAGE_SIZE_DEFAULT = 20;
const SESSION_PAGE_SIZE_MAX = 50;

export { SESSION_PAGE_SIZE_DEFAULT, SESSION_PAGE_SIZE_MAX };

export class SessionListRequestDto {
  @ApiPropertyOptional(cursorQueryDocs())
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: SESSION_PAGE_SIZE_DEFAULT,
      max: SESSION_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SESSION_PAGE_SIZE_MAX)
  limit?: number;
}
