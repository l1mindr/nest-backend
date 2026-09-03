import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** Crypto Fear & Greed Index snapshot, synchronised from alternative.me. */
export class FearGreedResponseDto {
  @ApiProperty({
    description:
      'The index value, from 0 (extreme fear) to 100 (extreme greed).',
    type: Number,
    minimum: 0,
    maximum: 100,
    example: 74
  })
  @Expose()
  value!: number;

  @ApiProperty({
    description: "The provider's classification of the current value.",
    example: 'Greed'
  })
  @Expose()
  classification!: string;

  @ApiProperty({
    description:
      'Instant at which the provider published this value — not when this API fetched it, since the response may be served from a cache.',
    format: 'date-time',
    example: '2026-08-02T14:35:00.000Z'
  })
  @Expose()
  updatedAt!: Date;

  @ApiProperty({
    description:
      'Instant at which the provider expects to publish its next value, or `null` when the provider did not report one.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-08-03T00:00:00.000Z'
  })
  @Expose()
  nextUpdateAt!: Date | null;
}
