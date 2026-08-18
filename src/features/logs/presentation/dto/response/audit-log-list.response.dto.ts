import { ApiProperty } from '@nestjs/swagger';
import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { AuditLogResponseDto } from './audit-log.response.dto';

export class AuditLogListResponseDto {
  @ApiProperty({
    description: 'Audit log entries on this page, newest first.',
    type: [AuditLogResponseDto]
  })
  items!: AuditLogResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
