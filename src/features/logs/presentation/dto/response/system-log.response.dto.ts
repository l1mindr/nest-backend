import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SystemLogEvent,
  SystemLogLevel
} from '../../../domain/enums/system.enum';

const SYSTEM_LOG_EXAMPLE_ID = '6872f1b4d3c2e1a0b9f8e7d6';
const SYSTEM_LOG_EXAMPLE_TIMESTAMP = '2026-08-17T14:35:00.000Z';

export class SystemLogErrorDto {
  @ApiProperty({ description: 'Error class name.', example: 'DatabaseError' })
  name!: string;

  @ApiProperty({
    description: 'Error message.',
    example: 'Connection timeout'
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Stack trace, when available.',
    type: String,
    nullable: true
  })
  stack?: string;

  @ApiPropertyOptional({
    description: 'Vendor error code, when available.',
    type: String,
    nullable: true
  })
  code?: string;
}

export class SystemLogResponseDto {
  @ApiProperty({
    description: 'MongoDB document identifier.',
    example: SYSTEM_LOG_EXAMPLE_ID
  })
  id!: string;

  @ApiProperty({
    description: 'When the event occurred.',
    format: 'date-time',
    example: SYSTEM_LOG_EXAMPLE_TIMESTAMP
  })
  timestamp!: Date;

  @ApiProperty({
    description: 'Severity level.',
    enum: SystemLogLevel,
    example: SystemLogLevel.ERROR
  })
  level!: SystemLogLevel;

  @ApiProperty({
    description: 'Classification of the event.',
    enum: SystemLogEvent,
    example: SystemLogEvent.APPLICATION_ERROR
  })
  event!: SystemLogEvent;

  @ApiProperty({
    description: 'Human-readable description of the event.',
    example: 'Asset synchronization failed'
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Source service or class name.',
    type: String,
    nullable: true,
    example: 'AssetSyncProcessor'
  })
  context?: string;

  @ApiPropertyOptional({
    description: 'User associated with the event, when applicable.',
    type: String,
    nullable: true
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Correlation/request identifier, when available.',
    type: String,
    nullable: true
  })
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Safe non-sensitive metadata.',
    type: Object,
    nullable: true
  })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Error details, when the event recorded an exception.',
    type: SystemLogErrorDto,
    nullable: true
  })
  error?: SystemLogErrorDto;

  @ApiPropertyOptional({
    description: 'Duration of the operation in milliseconds, when available.',
    type: Number,
    nullable: true,
    example: 1250
  })
  durationMs?: number;

  @ApiProperty({
    description: 'When the document was persisted.',
    format: 'date-time',
    example: SYSTEM_LOG_EXAMPLE_TIMESTAMP
  })
  createdAt!: Date;
}
