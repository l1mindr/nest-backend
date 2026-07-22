import { User } from '@features/users/entities/user.entity';
import { ErrorResponseDto } from '@infrastructure/http/dto/error-response.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SESSION_PAGE_SIZE_MAX } from './dto/request/session-list-request.dto';
import { SessionListResponseDto } from './dto/response/session-list-response.dto';

export const SwaggerSessionProperties = {
  id: { description: 'UUID of the user', example: 'uuid', readOnly: true },
  refreshTokenHash: {
    description: 'The unique token for this session used for authentication.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    uniqueItems: true
  },
  userAgent: {
    description:
      'JSON object representing the device details for this session.',
    example: {
      deviceType: 'mobile',
      os: 'iOS',
      browser: 'Safari',
      browserVersion: '14.0'
    }
  },
  ipAddress: {
    description: 'The IP address from which the session was initiated.',
    example: '192.168.1.100'
  },
  expireAt: {
    description: 'The expiration date of the session.',
    example: '2024-09-25T10:00:00.000Z'
  },
  lastUsedAt: {
    description: 'The last time this session was used.',
    example: '2024-09-25T10:00:00.000Z'
  },
  createdAt: {
    description: 'The date and time the session was created.',
    example: '2024-09-25T10:00:00.000Z'
  },
  updatedAt: {
    description: 'The date and time the session was last updated.',
    example: '2024-09-25T10:00:00.000Z'
  },
  user: {
    description: 'The user who owns this session.',
    type: () => User
  }
};

export const ApiGetSessions = () =>
  applyDecorators(
    ApiOperation({ summary: 'List active sessions for current user' }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description:
        'Opaque cursor from a previous response to fetch the next page.'
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: `Number of items per page (1–${SESSION_PAGE_SIZE_MAX}, default 20).`,
      example: 20
    }),
    ApiResponse({
      status: 200,
      description: 'Active sessions retrieved successfully',
      type: SessionListResponseDto
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid cursor',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 422,
      description: 'Validation error (e.g. limit out of range)',
      type: ErrorResponseDto
    })
  );

export const ApiRevokeCurrentSession = () =>
  applyDecorators(
    ApiOperation({ summary: 'Revoke current session (sign out)' }),
    ApiResponse({
      status: 204,
      description: 'Current session revoked successfully'
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
      type: ErrorResponseDto
    })
  );

export const ApiTerminateOtherSessions = () =>
  applyDecorators(
    ApiOperation({ summary: 'Terminate all other active sessions' }),
    ApiResponse({
      status: 204,
      description: 'Other sessions terminated successfully'
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
      type: ErrorResponseDto
    })
  );
