import { RegistryDatesOrm } from '@infrastructure/databases/postgres/embedded/registry-dates.embedded';
import { ErrorResponseDto } from '@infrastructure/http/dto/error-response.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Session } from './../sessions/entities/session.entity';
import { AdminUsersListResponseDto } from './dto/response/admin-users-list.response.dto';
import { AdminUserResponseDto } from './dto/response/admin-user.response.dto';
import { UserProfileResponseDto } from './dto/response/user-profile.response.dto';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';

export const SwaggerUserProperties = {
  id: { description: 'UUID of the user', example: 'uuid', readOnly: true },
  name: { description: 'Name of the user', example: 'John Doe', maxLength: 50 },
  email: {
    description: 'User email',
    example: 'user@example.com',
    uniqueItems: true
  },
  username: {
    description: 'Username',
    example: 'john_doe',
    maxLength: 30,
    uniqueItems: true
  },
  password: {
    description: 'User password',
    example: 'P@ssw0rd!',
    writeOnly: true
  },
  status: { description: 'User status', enum: UserStatus, example: 'ACTIVATE' },
  role: { description: 'User role', enum: UserRole, example: 'USER' },
  registryDates: {
    description: 'Registry dates',
    type: () => RegistryDatesOrm
  },
  sessions: { description: 'User sessions', type: () => [Session] },
  isDeleted: {
    description:
      'Determines if the user has been soft-deleted by checking the deletion timestamp.',
    example: true
  }
};

/** Get User Profile Swagger */
export const ApiGetProfile = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get user profile' }),
    ApiResponse({
      status: 200,
      description: 'User profile retrieved successfully',
      type: UserProfileResponseDto
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ErrorResponseDto
    })
  );

/** Change User Profile Swagger */
export const ApiChangeProfile = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update user profile' }),
    ApiResponse({
      status: 204,
      description: 'User profile updated successfully (no content)'
    }),
    ApiResponse({
      status: 422,
      description: 'Duplicate data conflict',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ErrorResponseDto
    })
  );

/** Delete User Account Swagger */
export const ApiDeleteAccount = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Request account deletion',
      description:
        'Marks the user account for deletion. The account will be permanently removed after the grace period.'
    }),
    ApiResponse({
      status: 204,
      description: 'User account deleted successfully (no content)'
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 409,
      description: 'User cannot be deleted due to related data',
      schema: {
        example: {
          statusCode: 409,
          message: 'user is referenced elsewhere',
          error: 'Conflict',
          path: '/user'
        }
      }
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ErrorResponseDto
    })
  );

/** Admin - Get All Users Swagger */
export const ApiAdminGetAllUsers = () =>
  applyDecorators(
    ApiOperation({ summary: '[Admin] Get all users' }),
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
      description: 'Number of items per page (1–100, default 20).',
      example: 20
    }),
    ApiResponse({
      status: 200,
      description: 'Successfully retrieved users',
      type: AdminUsersListResponseDto
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid cursor',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 422,
      description: 'Validation error (e.g. limit out of range)',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      type: ErrorResponseDto
    })
  );

/** Admin - Get Single User Swagger */
export const ApiAdminGetUser = () =>
  applyDecorators(
    ApiOperation({ summary: '[Admin] Retrieve a single user by ID' }),
    ApiParam({
      name: 'id',
      type: String,
      required: true,
      description: 'User ID'
    }),
    ApiResponse({
      status: 200,
      description: 'User found',
      type: AdminUserResponseDto
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      type: ErrorResponseDto
    })
  );
