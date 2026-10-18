import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';
import { ACTIVITY_TYPES } from './constants.js';

const activityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', default: null, index: true },
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', default: null, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    activityType: { type: String, enum: ACTIVITY_TYPES, required: true, index: true },
    timestamp: { type: Date, default: Date.now },
    /** User-local calendar date (YYYY-MM-DD) for timezone-aware history and streaks. */
    localDate: { type: String, default: '', index: true },
    minutes: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ userId: 1, localDate: 1 });
activityLogSchema.index({ enrollmentId: 1, timestamp: -1 });

export type ActivityLogDocument = InferSchemaType<typeof activityLogSchema> & mongoose.Document;
export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
