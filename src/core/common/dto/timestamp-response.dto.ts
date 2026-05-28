import { Expose } from 'class-transformer';

export abstract class TimestampResponseDto {
  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt?: Date | null;
}
