import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';

const dailyActivitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** User-local calendar date in YYYY-MM-DD form. */
    date: { type: String, required: true, index: true },
    timezone: { type: String, default: 'UTC' },
    completedTasks: { type: Number, default: 0, min: 0 },
    learningMinutes: { type: Number, default: 0, min: 0 },
    activeRoadmaps: { type: [{ type: Schema.Types.ObjectId, ref: 'Roadmap' }], default: [] },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

dailyActivitySchema.index({ userId: 1, date: 1 }, { unique: true });
dailyActivitySchema.index({ userId: 1, date: -1 });

export type DailyActivityDocument = InferSchemaType<typeof dailyActivitySchema> & mongoose.Document;
export const DailyActivity = mongoose.model('DailyActivity', dailyActivitySchema);
