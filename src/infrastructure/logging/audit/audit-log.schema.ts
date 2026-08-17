import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '../mongodb/mongodb.constants';

@Schema({
  collection: 'audit_logs',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false
})
export class AuditLog extends Document {
  @Prop({ required: true, type: Date, default: () => new Date() })
  timestamp: Date;

  @Prop({ required: false, type: String, index: true })
  userId?: string;

  @Prop({ required: true, type: String, enum: Object.values(ActorType) })
  actorType: ActorType;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(AuditAction),
    index: true
  })
  action: AuditAction;

  @Prop({ required: false, type: String, enum: Object.values(ResourceType) })
  resourceType?: ResourceType;

  @Prop({ required: false, type: String })
  resourceId?: string;

  @Prop({ required: true, type: Boolean })
  success: boolean;

  @Prop({ required: false, type: String })
  ipAddress?: string;

  @Prop({ required: false, type: String })
  userAgent?: string;

  @Prop({ required: false, type: String, index: true })
  requestId?: string;

  @Prop({ required: false, type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ required: true, type: Date })
  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes for efficient querying
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
AuditLogSchema.index({ requestId: 1 });
