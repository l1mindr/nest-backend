import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '../../../domain/enums/audit.enum';

const AUDIT_LOG_EXAMPLE_ID = '6872f1a3c5e4d2b1a0f9e8d7';
const AUDIT_LOG_EXAMPLE_TIMESTAMP = '2026-08-17T14:35:00.000Z';

export class AuditLogResponseDto {
  @ApiProperty({
    description: 'MongoDB document identifier.',
    example: AUDIT_LOG_EXAMPLE_ID
  })
  id!: string;

  @ApiProperty({
    description: 'When the action was performed.',
    format: 'date-time',
    example: AUDIT_LOG_EXAMPLE_TIMESTAMP
  })
  timestamp!: Date;

  @ApiProperty({
    description: 'Who performed the action.',
    enum: ActorType,
    example: ActorType.USER
  })
  actorType!: ActorType;

  @ApiPropertyOptional({
    description: 'Identifier of the acting user when known.',
    type: String,
    nullable: true,
    example: '7c4f2f6a-1f2d-4a1b-9c3e-8d5b6a0e1f24'
  })
  userId?: string;

  @ApiProperty({
    description: 'The audited action.',
    enum: AuditAction,
    example: AuditAction.USER_LOGIN
  })
  action!: AuditAction;

  @ApiPropertyOptional({
    description: 'Kind of resource the action targeted, when applicable.',
    enum: ResourceType,
    nullable: true,
    example: ResourceType.SESSION
  })
  resourceType?: ResourceType;

  @ApiPropertyOptional({
    description: 'Identifier of the targeted resource, when applicable.',
    type: String,
    nullable: true
  })
  resourceId?: string;

  @ApiProperty({
    description:
      '`true` when the action completed successfully; `false` on failure.',
    example: true
  })
  success!: boolean;

  @ApiPropertyOptional({
    description: 'IP address of the request, when available.',
    type: String,
    nullable: true,
    example: '192.168.1.1'
  })
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User-agent summary of the request, when available.',
    type: String,
    nullable: true
  })
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'Correlation/request identifier, when available.',
    type: String,
    nullable: true
  })
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Safe non-sensitive metadata associated with the event.',
    type: Object,
    nullable: true
  })
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: 'When the document was persisted.',
    format: 'date-time',
    example: AUDIT_LOG_EXAMPLE_TIMESTAMP
  })
  createdAt!: Date;
}
