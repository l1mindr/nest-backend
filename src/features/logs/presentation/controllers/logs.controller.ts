import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@features/security/decorators/roles.decorator';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import {
  IListAuditLogsUseCase,
  IListSystemLogsUseCase,
  LIST_AUDIT_LOGS_USE_CASE,
  LIST_SYSTEM_LOGS_USE_CASE
} from '../../application/interfaces/logs.interface';
import { AuditLogListRequestDto } from '../dto/request/audit-log-list.request.dto';
import { SystemLogListRequestDto } from '../dto/request/system-log-list.request.dto';
import { AuditLogListResponseDto } from '../dto/response/audit-log-list.response.dto';
import { SystemLogListResponseDto } from '../dto/response/system-log-list.response.dto';
import { ApiListAuditLogs, ApiListSystemLogs } from '../swagger/logs.swagger';

@Controller({
  path: 'logs',
  version: '1'
})
@ApiTags(ApiTagName.LOGS)
@Roles(UserRole.OWNER)
export class LogsController {
  constructor(
    @Inject(LIST_AUDIT_LOGS_USE_CASE)
    private readonly listAuditLogsUseCase: IListAuditLogsUseCase,
    @Inject(LIST_SYSTEM_LOGS_USE_CASE)
    private readonly listSystemLogsUseCase: IListSystemLogsUseCase
  ) {}

  @Get('audit')
  @HttpCode(HttpStatus.OK)
  @ApiListAuditLogs()
  async listAuditLogs(
    @Query() dto: AuditLogListRequestDto
  ): Promise<AuditLogListResponseDto> {
    const result = await this.listAuditLogsUseCase.execute(dto);
    return {
      items: result.items,
      nextCursor: result.nextCursor
    };
  }

  @Get('system')
  @HttpCode(HttpStatus.OK)
  @ApiListSystemLogs()
  async listSystemLogs(
    @Query() dto: SystemLogListRequestDto
  ): Promise<SystemLogListResponseDto> {
    const result = await this.listSystemLogsUseCase.execute(dto);
    return {
      items: result.items,
      nextCursor: result.nextCursor
    };
  }
}
