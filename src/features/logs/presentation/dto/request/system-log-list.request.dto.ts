import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
  SystemLogEvent,
  SystemLogLevel
} from '../../../domain/enums/system.enum';

const SYSTEM_LOGS_PAGE_SIZE_DEFAULT = 50;
const SYSTEM_LOGS_PAGE_SIZE_MAX = 200;

export { SYSTEM_LOGS_PAGE_SIZE_DEFAULT, SYSTEM_LOGS_PAGE_SIZE_MAX };

export class SystemLogListRequestDto {
  @ApiPropertyOptional(cursorQueryDocs())
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: SYSTEM_LOGS_PAGE_SIZE_DEFAULT,
      max: SYSTEM_LOGS_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SYSTEM_LOGS_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by log severity level.',
    enum: SystemLogLevel
  })
  @IsOptional()
  @IsEnum(SystemLogLevel)
  level?: SystemLogLevel;

  @ApiPropertyOptional({
    description: 'Filter by system log event type.',
    enum: SystemLogEvent
  })
  @IsOptional()
  @IsEnum(SystemLogEvent)
  event?: SystemLogEvent;

  @ApiPropertyOptional({
    description: 'Filter by source context (e.g. service or class name).'
  })
  @IsOptional()
  @IsString()
  context?: string;

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

  @ApiPropertyOptional({
    description: 'Filter by the user associated with the event.'
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
