import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity()
export class Coin {
  @ApiProperty({
    description: 'CoinGecko identifier',
    example: 'bitcoin'
  })
  @PrimaryColumn()
  id!: string;

  @ApiProperty({
    description: 'Ticker symbol',
    example: 'btc'
  })
  @Column()
  symbol!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'Bitcoin'
  })
  @Column()
  name!: string;

  @ApiPropertyOptional({
    description: 'URL of the coin image',
    nullable: true
  })
  @Column({ type: 'varchar', nullable: true })
  image!: string | null;

  @ApiProperty({
    description: 'Whether the coin is actively synced'
  })
  @Column({ default: true })
  isActive!: boolean;

  @ApiProperty({
    description: 'Timestamp of the last successful sync'
  })
  @Column({ type: 'timestamp' })
  lastSyncedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
