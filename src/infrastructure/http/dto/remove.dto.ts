import { ToBoolean } from '@infrastructure/http/validation/decorators/to-boolean.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RemoveDto {
  @ApiPropertyOptional({
    description:
      'The "soft" property is optional and indicates whether to perform a soft delete.'
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  readonly soft: boolean;
}
