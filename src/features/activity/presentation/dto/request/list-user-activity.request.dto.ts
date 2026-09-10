import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
import { ActivityCategory } from '../../../domain/enums/activity-category.enum';

export const ACTIVITY_PAGE_SIZE_DEFAULT = 20;
export const ACTIVITY_PAGE_SIZE_MAX = 100;

/**
 * Note what is absent: there is no `userId`. The endpoint reads the caller's
 * own activities and takes the identity from the authenticated principal, so
 * there is no field here for a client to set — a `?userId=` on the query
 * string is an unknown property and is discarded by the global validation
 * pipe rather than being honoured.
 */
export class ListUserActivityRequestDto {
  @ApiPropertyOptional(cursorQueryDocs())
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: ACTIVITY_PAGE_SIZE_DEFAULT,
      max: ACTIVITY_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ACTIVITY_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Return only activities in this category. Omit for every category.',
    enum: ActivityCategory,
    example: ActivityCategory.TRANSACTION
  })
  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;
}
