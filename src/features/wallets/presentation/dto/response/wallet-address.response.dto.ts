import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { WalletNetwork } from '../../../domain/enums/wallet-network.enum';

/** One network-specific address of a wallet. */
export class WalletAddressResponseDto {
  @ApiProperty({
    description: 'Identifier of the address entry, as a UUID.',
    format: 'uuid',
    example: 'a1b2c3d4-0000-4000-8000-000000000001'
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Blockchain network this address belongs to.',
    enum: WalletNetwork,
    enumName: 'WalletNetwork',
    example: WalletNetwork.SOLANA
  })
  @Expose()
  network!: WalletNetwork;

  @ApiProperty({
    description: 'Address on that network, exactly as stored.',
    example: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  })
  @Expose()
  address!: string;
}
