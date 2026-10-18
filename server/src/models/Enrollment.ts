import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';
import { ENROLLMENT_STATUSES, LEARNING_PACES } from './constants.js';

const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    curriculumVersion: { type: Number, default: 1 },
    status: { type: String, enum: ENROLLMENT_STATUSES, default: 'active', index: true },
    enrolledAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    learningPace: { type: String, enum: LEARNING_PACES, default: 'standard' },
    customDailyGoal: { type: Number, default: null, min: 5, max: 300 },
    lastActivityAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

// A user can only have one enrollment per roadmap.
enrollmentSchema.index({ userId: 1, roadmapId: 1 }, { unique: true });
enrollmentSchema.index({ userId: 1, status: 1 });
enrollmentSchema.index({ roadmapId: 1, status: 1 });

export type EnrollmentDocument = InferSchemaType<typeof enrollmentSchema> & mongoose.Document;
export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
