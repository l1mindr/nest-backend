import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWalletRequestDto {
  @ApiProperty({
    description: 'Display name of the wallet.',
    example: 'MetaMask'
  })
  @Trim()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Wallet address, if known.',
    nullable: true,
    example: '0x1234...'
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  address?: string;
}
