import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

/** Route parameters for endpoints addressing a single session. */
export class SessionParamsDto {
  @ApiProperty({
    description:
      'Identifier of the session, as returned in `sessionId` by `GET /v1/sessions`.',
    format: 'uuid',
    example: 'b3f1c2d4-5e6a-4b7c-8d9e-0f1a2b3c4d5e'
  })
  @IsString()
  @IsUUID()
  readonly sessionId!: string;
}
