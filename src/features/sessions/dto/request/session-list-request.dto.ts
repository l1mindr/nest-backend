import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const SESSION_PAGE_SIZE_DEFAULT = 20;
const SESSION_PAGE_SIZE_MAX = 50;

export { SESSION_PAGE_SIZE_DEFAULT, SESSION_PAGE_SIZE_MAX };

export class SessionListRequestDto {
  @ApiPropertyOptional({
    description:
      'Opaque cursor obtained from a previous response. Omit to start from the beginning.',
    example: undefined
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: `Number of items to return per page (1–${SESSION_PAGE_SIZE_MAX}). Defaults to ${SESSION_PAGE_SIZE_DEFAULT}.`,
    minimum: 1,
    maximum: SESSION_PAGE_SIZE_MAX,
    default: SESSION_PAGE_SIZE_DEFAULT,
    example: SESSION_PAGE_SIZE_DEFAULT
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SESSION_PAGE_SIZE_MAX)
  limit?: number;
}
