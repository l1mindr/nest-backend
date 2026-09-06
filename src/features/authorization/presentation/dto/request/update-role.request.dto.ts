import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ROLE_NAME_PATTERN } from './create-role.request.dto';

export class UpdateRoleRequestDto {
  @ApiPropertyOptional({
    description:
      'New name for the role. Uppercase snake case, matching the style of a permission code.',
    example: 'SUPPORT_READ_ONLY'
  })
  @IsOptional()
  @IsString()
  @Matches(ROLE_NAME_PATTERN, {
    message:
      'name must be uppercase snake case, starting with a letter (e.g. SUPPORT, READ_ONLY)'
  })
  readonly name?: string;

  @ApiPropertyOptional({
    description: 'What this role is for.',
    example: 'Read-only access to the user directory.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly description?: string;
}
