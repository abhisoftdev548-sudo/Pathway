import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';

const achievementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'award' },
    category: { type: String, default: 'milestone' },
    earnedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

// Avoid awarding duplicate achievements for the same milestone (including per-roadmap keys).
achievementSchema.index({ userId: 1, key: 1 }, { unique: true });

export type AchievementDocument = InferSchemaType<typeof achievementSchema> & mongoose.Document;
export const Achievement = mongoose.model('Achievement', achievementSchema);
