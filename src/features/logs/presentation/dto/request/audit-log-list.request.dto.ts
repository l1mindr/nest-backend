import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';
import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '../../../domain/enums/audit.enum';
import { toBoolean } from '@core/utils/to-boolean';

const AUDIT_LOGS_PAGE_SIZE_DEFAULT = 50;
const AUDIT_LOGS_PAGE_SIZE_MAX = 200;

export { AUDIT_LOGS_PAGE_SIZE_DEFAULT, AUDIT_LOGS_PAGE_SIZE_MAX };

export class AuditLogListRequestDto {
  @ApiPropertyOptional(cursorQueryDocs())
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: AUDIT_LOGS_PAGE_SIZE_DEFAULT,
      max: AUDIT_LOGS_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_LOGS_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by the user who performed the action.',
    type: String
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by audit action.',
    enum: AuditAction
  })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({
    description: 'Filter by resource type.',
    enum: ResourceType
  })
  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType;

  @ApiPropertyOptional({
    description: 'Filter by resource identifier.'
  })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor type.',
    enum: ActorType
  })
  @IsOptional()
  @IsEnum(ActorType)
  actorType?: ActorType;

  @ApiPropertyOptional({
    description:
      'Filter by outcome — `true` for successful actions only, `false` for failures only.'
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  success?: boolean;

  @ApiPropertyOptional({
    description: 'Earliest timestamp (inclusive). ISO 8601 date-time string.',
    format: 'date-time'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Latest timestamp (inclusive). ISO 8601 date-time string.',
    format: 'date-time'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by correlation/request identifier.'
  })
  @IsOptional()
  @IsString()
  requestId?: string;
}
