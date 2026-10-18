import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';
import { RESOURCE_TYPES } from './constants.js';

const topicResourceSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    url: { type: String, required: true, maxlength: 500 },
    type: { type: String, enum: RESOURCE_TYPES, default: 'suggestion' },
  },
  { _id: false },
);

const topicSchema = new Schema(
  {
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 3000 },
    order: { type: Number, required: true, min: 1 },
    estimatedDuration: { type: Number, default: 60, min: 0, max: 2000 },
    learningOutcomes: { type: [String], default: [] },
    prerequisites: { type: [{ type: Schema.Types.ObjectId, ref: 'Topic' }], default: [] },
    resources: { type: [topicResourceSchema], default: [] },
    published: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

topicSchema.index({ roadmapId: 1, key: 1 }, { unique: true });
topicSchema.index({ moduleId: 1, order: 1 });
topicSchema.index({ roadmapId: 1, published: 1, archivedAt: 1 });

export type TopicDocument = InferSchemaType<typeof topicSchema> & mongoose.Document;
export const Topic = mongoose.model('Topic', topicSchema);
