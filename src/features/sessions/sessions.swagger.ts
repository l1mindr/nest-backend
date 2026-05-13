import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { User } from '@features/users/entities/user.entity';
import { ErrorResponseDto } from '@infrastructure/http/dto/error-response.dto';
import { SessionsDto } from './dto/sessions.dto';

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
    description: 'The expiration date of the session.',
    example: '2024-09-25T10:00:00.000Z'
  },
  createdAt: {
    description: 'The expiration date of the session.',
    example: '2024-09-25T10:00:00.000Z'
  },
  updatedAt: {
    description: 'The expiration date of the session.',
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
    ApiResponse({
      status: 200,
      description: 'Active sessions retrieved successfully',
      type: [SessionsDto]
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
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
