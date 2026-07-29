import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code of the error',
    example: 400
  })
  statusCode: number;

  @ApiProperty({
    description: 'Description of the error',
    example: 'User already exists'
  })
  message: string;

  @ApiProperty({
    description: 'Type of error',
    example: 'Unprocessable Entity'
  })
  error: string;

  @ApiProperty({
    description: 'Timestamp of the error occurrence',
    example: '2024-09-25T14:35:00.000Z'
  })
  timestamp: string;

  @ApiProperty({
    description: 'Path of the request that resulted in the error',
    example: '/api/users'
  })
  path: string;

  @ApiProperty({
    description: 'Additional details regarding the error',
    example: 'The email provided is already in use.',
    required: false
  })
  details?: string;

  constructor(
    statusCode: number,
    message: string,
    error: string,
    path: string,
    details?: string
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.error = error;
    this.timestamp = new Date().toISOString();
    this.path = path;
    this.details = details;
  }
}
