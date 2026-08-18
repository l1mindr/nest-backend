import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse
} from '@nestjs/swagger';
import { AuditLogListResponseDto } from '../dto/response/audit-log-list.response.dto';
import { SystemLogListResponseDto } from '../dto/response/system-log-list.response.dto';

export function ApiListAuditLogs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List audit logs (Owner only)',
      description:
        'Retrieve paginated audit logs with optional filters. Only accessible to users with OWNER role.'
    }),
    ApiBearerAuth(),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of logs to return (max 100, default 50)'
    }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Pagination cursor from previous response'
    }),
    ApiQuery({
      name: 'userId',
      required: false,
      type: String,
      description: 'Filter by user ID'
    }),
    ApiQuery({
      name: 'action',
      required: false,
      type: String,
      description:
        'Filter by audit action (e.g., USER_LOGIN, PORTFOLIO_CREATED)'
    }),
    ApiQuery({
      name: 'resourceType',
      required: false,
      type: String,
      description: 'Filter by resource type (e.g., USER, PORTFOLIO)'
    }),
    ApiQuery({
      name: 'resourceId',
      required: false,
      type: String,
      description: 'Filter by resource ID'
    }),
    ApiQuery({
      name: 'actorType',
      required: false,
      type: String,
      description: 'Filter by actor type (USER, SYSTEM, ADMIN)'
    }),
    ApiQuery({
      name: 'success',
      required: false,
      type: Boolean,
      description: 'Filter by success status'
    }),
    ApiQuery({
      name: 'requestId',
      required: false,
      type: String,
      description: 'Filter by request/correlation ID'
    }),
    ApiQuery({
      name: 'startDate',
      required: false,
      type: String,
      description: 'Filter logs after this ISO 8601 timestamp'
    }),
    ApiQuery({
      name: 'endDate',
      required: false,
      type: String,
      description: 'Filter logs before this ISO 8601 timestamp'
    }),
    ApiResponse({
      status: 200,
      description: 'Audit logs retrieved successfully',
      type: AuditLogListResponseDto
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthenticated'
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - OWNER role required'
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid query parameters'
    })
  );
}

export function ApiListSystemLogs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List system logs (Owner only)',
      description:
        'Retrieve paginated system logs with optional filters. Only accessible to users with OWNER role.'
    }),
    ApiBearerAuth(),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of logs to return (max 100, default 50)'
    }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Pagination cursor from previous response'
    }),
    ApiQuery({
      name: 'level',
      required: false,
      type: String,
      description: 'Filter by log level (ERROR, WARNING, INFO)'
    }),
    ApiQuery({
      name: 'event',
      required: false,
      type: String,
      description:
        'Filter by event type (e.g., APPLICATION_ERROR, DATABASE_ERROR)'
    }),
    ApiQuery({
      name: 'context',
      required: false,
      type: String,
      description: 'Filter by context/service name'
    }),
    ApiQuery({
      name: 'userId',
      required: false,
      type: String,
      description: 'Filter by user ID'
    }),
    ApiQuery({
      name: 'requestId',
      required: false,
      type: String,
      description: 'Filter by request/correlation ID'
    }),
    ApiQuery({
      name: 'startDate',
      required: false,
      type: String,
      description: 'Filter logs after this ISO 8601 timestamp'
    }),
    ApiQuery({
      name: 'endDate',
      required: false,
      type: String,
      description: 'Filter logs before this ISO 8601 timestamp'
    }),
    ApiResponse({
      status: 200,
      description: 'System logs retrieved successfully',
      type: SystemLogListResponseDto
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthenticated'
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - OWNER role required'
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid query parameters'
    })
  );
}
