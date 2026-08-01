import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiCookieAuth,
  ApiTooManyRequestsResponse
} from '@nestjs/swagger';
import { RegisterUserRequestDto } from '../dto/request/register-user.request.dto';
import { LoginUserResponseDto } from '../dto/response/login-user.response.dto';
import { VerifyEmailRequestDto } from '../dto/request/verify-email.request.dto';
import { ResendVerificationRequestDto } from '../dto/request/resend-verification.request.dto';
import { VerifyEmailResponseDto } from '../dto/response/verify-email.response.dto';
import { ResendVerificationResponseDto } from '../dto/response/resend-verification.response.dto';

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

export function ApiVerifyEmail() {
  return applyDecorators(
    ApiOperation({
      summary: 'Verify a user email with a one-time code',
      description:
        'Activates a PENDING_VERIFICATION account when the code is valid. Codes are strictly single-use and expire after 3 minutes; used, expired, and unknown codes all return the same generic error. Failed attempts are limited (5 per code, then the code is invalidated) and attempts are rate-limited per email (5 per 10 minutes) to resist brute force and IP rotation.'
    }),
    ApiBody({ type: VerifyEmailRequestDto }),
    ApiResponse({
      status: 200,
      description: 'Email verified successfully',
      type: VerifyEmailResponseDto
    }),
    ApiBadRequestResponse({
      description:
        'Invalid, expired, or already-used code; or the account is not pending verification'
    }),
    ApiTooManyRequestsResponse({
      description: 'Too many verification attempts (per IP or per email)'
    }),
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error'
    })
  );
}

export function ApiResendVerification() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resend a verification code',
      description:
        'Sends a new code to pending accounts only. The previous code is invalidated on every resend, so only one valid code exists per account. Enforced limits: a 60-second cooldown and a maximum of 5 resends per hour. The response is generic and does not reveal whether an account exists.'
    }),
    ApiBody({ type: ResendVerificationRequestDto }),
    ApiResponse({
      status: 200,
      description: 'Request accepted (generic response)',
      type: ResendVerificationResponseDto
    }),
    ApiBadRequestResponse({
      description: 'Invalid input data'
    }),
    ApiTooManyRequestsResponse({
      description: 'Too many resend requests from this IP'
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

export function ApiRefreshToken() {
  return applyDecorators(
    ApiOperation({
      summary: 'Refresh access token using refresh token cookie'
    }),
    ApiResponse({
      status: 200,
      description:
        'Tokens refreshed successfully, new JWT set in HttpOnly cookie',
      type: LoginUserResponseDto
    }),
    ApiBadRequestResponse({
      description: 'Missing or malformed refresh token cookie'
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or expired refresh token'
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
