import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** A wallet registered by the authenticated user, used as a transfer destination. */
export class WalletResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Identifier of the wallet, as a UUID.',
    format: 'uuid',
    example: ExampleValue.WALLET_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Display name of the wallet.',
    example: 'MetaMask'
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description: 'Wallet address, or `null` when not set.',
    type: String,
    nullable: true,
    example: '0x1234...'
  })
  @Expose()
  address!: string | null;
}
