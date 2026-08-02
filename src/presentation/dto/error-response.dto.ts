import { ErrorDomain } from '@core/errors/error-domain.enum';
import { ApiProperty } from '@nestjs/swagger';
import { ExampleValue } from '../swagger/openapi.constants';

/**
 * Body of the `error` envelope produced by `GlobalExceptionFilter`.
 *
 * Every failing request — validation, authentication, authorization,
 * business rule, or unexpected exception — is serialized through this shape.
 */
export class ApiErrorDetailDto {
  @ApiProperty({
    description:
      'Stable, machine-readable error code. Clients should branch on this value rather than on `message`, which is meant for humans and may change.',
    example: 'USER_NOT_FOUND'
  })
  code: string;

  @ApiProperty({
    description: 'Subsystem the error originated from.',
    enum: ErrorDomain,
    enumName: 'ErrorDomain',
    example: ErrorDomain.USER
  })
  domain: ErrorDomain;

  @ApiProperty({
    description: 'Human-readable explanation. Not intended for client logic.',
    example: 'User not found'
  })
  message: string;

  @ApiProperty({
    description:
      'Context for the error. Always present, empty when the error carries none. Validation failures expose the offending field as `field`; entity errors expose the relevant identifier.',
    type: 'object',
    additionalProperties: true,
    example: { userId: ExampleValue.USER_ID }
  })
  meta: Record<string, unknown>;

  @ApiProperty({
    description: 'Path of the request that produced the error.',
    example: `/v1/admin/users/${ExampleValue.USER_ID}`
  })
  path: string;

  @ApiProperty({
    description: 'ISO-8601 instant at which the error was produced.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  timestamp: string;
}

/**
 * Envelope returned for every non-2xx response.
 *
 * Mutually exclusive with the success envelope: a response carries either
 * `data` or `error`, never both.
 */
export class ErrorResponseDto {
  @ApiProperty({ type: ApiErrorDetailDto })
  error: ApiErrorDetailDto;
}
