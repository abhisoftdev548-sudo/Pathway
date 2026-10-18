import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';
import { DIFFICULTIES } from './constants.js';

const durationSchema = new Schema(
  {
    minWeeks: { type: Number, default: 4, min: 0 },
    maxWeeks: { type: Number, default: 8, min: 0 },
    totalHours: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const roadmapSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tagline: { type: String, default: '', maxlength: 180 },
    description: { type: String, required: true, maxlength: 4000 },
    category: { type: String, required: true, index: true, maxlength: 60 },
    difficulty: { type: String, enum: DIFFICULTIES, required: true, index: true },
    difficultyLabel: { type: String, default: '' },
    estimatedDuration: { type: durationSchema, default: () => ({}) },
    prerequisites: { type: [String], default: [] },
    learningOutcomes: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    icon: { type: String, default: 'route' },
    published: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    version: { type: Number, default: 1, min: 1 },
    seedVersion: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

roadmapSchema.index({ published: 1, archivedAt: 1, category: 1 });
roadmapSchema.index({ title: 'text', description: 'text', tags: 'text' });

export type RoadmapDocument = InferSchemaType<typeof roadmapSchema> & mongoose.Document;
export const Roadmap = mongoose.model('Roadmap', roadmapSchema);
