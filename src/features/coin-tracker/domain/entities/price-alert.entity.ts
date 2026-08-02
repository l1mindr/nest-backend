import { User } from '@features/users/domain/entities/user.entity';
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

/**
 * Persistence model. Never serialized to clients directly — the price-alert
 * endpoints project it through `PriceAlertResponseDto`, which is what keeps
 * `userId` out of the API surface and out of the OpenAPI schema.
 */
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
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column()
  coinId!: string;

  @Column({
    type: 'enum',
    enum: AlertDirection,
    enumName: 'alert_direction_enum'
  })
  direction!: AlertDirection;

  @Column({ type: 'decimal' })
  targetPrice!: string;

  @Column({
    type: 'enum',
    enum: AlertTriggerMode,
    enumName: 'alert_trigger_mode_enum',
    default: AlertTriggerMode.ONCE
  })
  triggerMode!: AlertTriggerMode;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    enumName: 'alert_status_enum',
    default: AlertStatus.ACTIVE
  })
  status!: AlertStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    enumName: 'notification_channel_enum',
    array: true
  })
  notificationChannels!: NotificationChannel[];

  @Column({ default: DEFAULT_NOTIFICATION_COOLDOWN_MINUTES })
  notificationCooldownMinutes!: number;

  @Column({ type: 'decimal', nullable: true })
  lastCheckedPrice!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggeredAt!: Date | null;

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
