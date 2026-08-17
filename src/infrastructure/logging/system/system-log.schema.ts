import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SystemLogEvent, SystemLogLevel } from '../mongodb/mongodb.constants';

@Schema({
  collection: 'system_logs',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false
})
export class SystemLog extends Document {
  @Prop({ required: true, type: Date, default: () => new Date() })
  timestamp: Date;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(SystemLogLevel),
    index: true
  })
  level: SystemLogLevel;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(SystemLogEvent),
    index: true
  })
  event: SystemLogEvent;

  @Prop({ required: true, type: String })
  message: string;

  @Prop({ required: false, type: String, index: true })
  context?: string;

  @Prop({ required: false, type: String })
  userId?: string;

  @Prop({ required: false, type: String, index: true })
  requestId?: string;

  @Prop({ required: false, type: Object })
  metadata?: Record<string, unknown>;

  @Prop({
    required: false,
    type: {
      name: { type: String, required: true },
      message: { type: String, required: true },
      stack: { type: String, required: false },
      code: { type: String, required: false }
    }
  })
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  @Prop({ required: false, type: Number })
  durationMs?: number;

  @Prop({ required: true, type: Date })
  createdAt: Date;
}

export const SystemLogSchema = SchemaFactory.createForClass(SystemLog);

// Indexes for efficient querying
SystemLogSchema.index({ timestamp: -1 });
SystemLogSchema.index({ level: 1, timestamp: -1 });
SystemLogSchema.index({ event: 1, timestamp: -1 });
SystemLogSchema.index({ context: 1, timestamp: -1 });
SystemLogSchema.index({ requestId: 1 });
