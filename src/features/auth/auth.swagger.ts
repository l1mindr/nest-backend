import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiCookieAuth
} from '@nestjs/swagger';
import { RegisterUserRequestDto } from './dto/request/register-user.request.dto';
import { LoginUserResponseDto } from './dto/response/login-user.response.dto';

export function ApiRegisterUser() {
  return applyDecorators(
    ApiOperation({ summary: 'Register a new user account' }),
    ApiResponse({
      status: 201,
      description: 'User successfully registered',
      type: RegisterUserRequestDto
    }),
    ApiBadRequestResponse({
      description: 'Invalid input data'
    }),
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error'
    })
  );
}

export function ApiLoginUser() {
  return applyDecorators(
    ApiOperation({ summary: 'User login with email/username and password' }),
    ApiResponse({
      status: 200,
      description: 'Successfully logged in, JWT set in HttpOnly cookie',
      type: LoginUserResponseDto
    }),
    ApiBadRequestResponse({
      description: 'Invalid credentials'
    }),
    ApiUnauthorizedResponse({
      description: 'User credentials are invalid'
    }),
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error'
    }),
    ApiCookieAuth()
  );
}

export function ApiChangePassword() {
  return applyDecorators(
    ApiOperation({
      summary: 'Change user password',
      description:
        'Allows an authenticated user to change their password. The current password must be provided for validation.'
    }),
    ApiResponse({
      status: 204,
      description: 'Password changed successfully'
    }),
    ApiBadRequestResponse({
      description:
        'Invalid input data, including incorrect current password or validation errors'
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized: User must be authenticated to change password'
    }),
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error'
    })
  );
}
