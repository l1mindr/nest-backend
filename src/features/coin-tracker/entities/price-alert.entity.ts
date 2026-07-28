import { User } from '@features/users/domain/entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { Coin } from './coin.entity';
import { AlertDirection } from '../enums/alert-direction.enum';
import { AlertStatus } from '../enums/alert-status.enum';
import { AlertTriggerMode } from '../enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';

export const DEFAULT_NOTIFICATION_COOLDOWN_MINUTES = 60;

@Entity()
@Index('IDX_price_alert_user_id', ['userId'])
@Index('IDX_price_alert_status', ['status'])
@Index('IDX_price_alert_coin_id', ['coinId'])
@Index('IDX_price_alert_user_status', ['userId', 'status'])
@Index('IDX_price_alert_status_coin', ['status', 'coinId'])
@Index('IDX_price_alert_expires_at', ['expiresAt'])
@Check('CHK_price_alert_target_price_positive', '"targetPrice" > 0')
@Check(
  'CHK_price_alert_notification_cooldown_positive',
  '"notificationCooldownMinutes" > 0'
)
@Check(
  'CHK_price_alert_notification_channels_not_empty',
  'cardinality("notificationChannels") > 0'
)
export class PriceAlert {
  @ApiProperty({
    description: 'Unique identifier',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'Owner user ID'
  })
  @Column({ type: 'uuid' })
  userId!: string;

  @ApiProperty({
    description: 'Coin identifier (CoinGecko id)'
  })
  @Column()
  coinId!: string;

  @ApiProperty({
    description: 'Price direction',
    enum: AlertDirection
  })
  @Column({
    type: 'enum',
    enum: AlertDirection,
    enumName: 'alert_direction_enum'
  })
  direction!: AlertDirection;

  @ApiProperty({
    description: 'Target price in USD'
  })
  @Column({ type: 'decimal' })
  targetPrice!: string;

  @ApiProperty({
    description: 'Trigger mode',
    enum: AlertTriggerMode
  })
  @Column({
    type: 'enum',
    enum: AlertTriggerMode,
    enumName: 'alert_trigger_mode_enum',
    default: AlertTriggerMode.ONCE
  })
  triggerMode!: AlertTriggerMode;

  @ApiProperty({
    description: 'Current alert status',
    enum: AlertStatus
  })
  @Column({
    type: 'enum',
    enum: AlertStatus,
    enumName: 'alert_status_enum',
    default: AlertStatus.ACTIVE
  })
  status!: AlertStatus;

  @ApiPropertyOptional({
    description: 'Expiration timestamp',
    nullable: true
  })
  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({
    description: 'Notification channels',
    enum: NotificationChannel,
    isArray: true
  })
  @Column({
    type: 'enum',
    enum: NotificationChannel,
    enumName: 'notification_channel_enum',
    array: true
  })
  notificationChannels!: NotificationChannel[];

  @ApiProperty({
    description: 'Minimum minutes between notifications'
  })
  @Column({ default: DEFAULT_NOTIFICATION_COOLDOWN_MINUTES })
  notificationCooldownMinutes!: number;

  @ApiPropertyOptional({
    description: 'Last checked price for crossing detection',
    nullable: true
  })
  @Column({ type: 'decimal', nullable: true })
  lastCheckedPrice!: string | null;

  @ApiPropertyOptional({
    description: 'Timestamp of last trigger',
    nullable: true
  })
  @Column({ type: 'timestamp', nullable: true })
  lastTriggeredAt!: Date | null;

  @ApiProperty({
    description: 'Number of times triggered'
  })
  @Column({ default: 0 })
  triggeredCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'userId' })
  owner!: User;

  @ManyToOne(() => Coin, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'coinId' })
  coin!: Coin;
}
