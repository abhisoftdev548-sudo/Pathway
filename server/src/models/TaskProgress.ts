import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';
import { PROGRESS_STATUSES } from './constants.js';

const taskProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    status: { type: String, enum: PROGRESS_STATUSES, default: 'not_started', index: true },
    completedAt: { type: Date, default: null },
    firstCompletedAt: { type: Date, default: null },
    actualDuration: { type: Number, default: 0, min: 0, max: 1440 },
    privateNotes: { type: String, default: '', maxlength: 10000 },
    attemptCount: { type: Number, default: 0, min: 0 },
    selfVerified: { type: Boolean, default: false },
    lastInteractionAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

// Exactly one progress record per user + task. This is the authoritative completion state.
taskProgressSchema.index({ userId: 1, taskId: 1 }, { unique: true });
taskProgressSchema.index({ enrollmentId: 1, status: 1 });
taskProgressSchema.index({ userId: 1, completedAt: -1 });
taskProgressSchema.index({ userId: 1, lastInteractionAt: -1 });

export type TaskProgressDocument = InferSchemaType<typeof taskProgressSchema> & mongoose.Document;
export const TaskProgress = mongoose.model('TaskProgress', taskProgressSchema);
