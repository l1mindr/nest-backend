import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { CalculationTransactionType } from '../../../domain/calculation/types/calculation-transaction.types';

/** One realized P&L event, produced by a SELL disposal. */
export class RealizedPnlEventResponseDto {
  @ApiPropertyOptional({
    description:
      'Identifier of the SELL transaction that realized the gain, as a UUID.',
    format: 'uuid',
    example: ExampleValue.HOLDING_ID
  })
  @Expose()
  transactionId?: string;

  @ApiProperty({
    description: 'Instant at which the disposal occurred.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  occurredAt!: string;

  @ApiProperty({
    description:
      'Only SELL disposals realize P&L; transfers are custody moves.',
    enum: CalculationTransactionType,
    enumName: 'CalculationTransactionType',
    example: CalculationTransactionType.SELL
  })
  @Expose()
  type!: CalculationTransactionType;

  @ApiProperty({
    description: 'Quantity disposed, as a decimal string.',
    type: String,
    example: '0.5'
  })
  @Expose()
  amount!: string;

  @ApiProperty({
    description: 'Unit price of the disposal, as a decimal string.',
    type: String,
    example: '60000'
  })
  @Expose()
  price!: string;

  @ApiProperty({
    description:
      'Gross proceeds (`amount × price`), as a decimal string, before any fee.',
    type: String,
    example: '30000'
  })
  @Expose()
  proceeds!: string;

  @ApiProperty({
    description:
      'Acquisition cost released from the position, as a decimal string.',
    type: String,
    example: '25000'
  })
  @Expose()
  releasedCostBasis!: string;

  @ApiProperty({
    description:
      'Realized gain (`proceeds − releasedCostBasis`), as a decimal string. Reported gross of fees.',
    type: String,
    example: '5000'
  })
  @Expose()
  realizedPnl!: string;

  @ApiPropertyOptional({
    description:
      'Fee paid for the trade, carried through unchanged. It is never netted into `proceeds` or `realizedPnl`, which stay gross.',
    type: String,
    example: '10'
  })
  @Expose()
  fee?: string;
}
