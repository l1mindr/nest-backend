import { ApiProperty } from '@nestjs/swagger';
import { nextCursorDocs } from '@presentation/dto/pagination.docs';
import { SystemLogResponseDto } from './system-log.response.dto';

export class SystemLogListResponseDto {
  @ApiProperty({
    description: 'System log entries on this page, newest first.',
    type: [SystemLogResponseDto]
  })
  items!: SystemLogResponseDto[];

  @ApiProperty(nextCursorDocs())
  nextCursor!: string | null;
}
