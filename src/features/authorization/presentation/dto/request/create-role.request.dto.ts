import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

export class CreateRoleRequestDto {
  @ApiProperty({
    description:
      'Unique, machine-readable name for the role. Uppercase snake case, matching the style of a permission code.',
    example: 'SUPPORT'
  })
  @IsString()
  @Matches(ROLE_NAME_PATTERN, {
    message:
      'name must be uppercase snake case, starting with a letter (e.g. SUPPORT, READ_ONLY)'
  })
  readonly name!: string;

  @ApiPropertyOptional({
    description: 'What this role is for.',
    example: 'Read-only access to the user directory and audit trail.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly description?: string;
}

export { ROLE_NAME_PATTERN };
