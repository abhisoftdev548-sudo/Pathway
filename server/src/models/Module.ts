import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';

const moduleSchema = new Schema(
  {
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 2000 },
    order: { type: Number, required: true, min: 1 },
    learningOutcomes: { type: [String], default: [] },
    prerequisiteModuleIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Module' }], default: [] },
    published: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

moduleSchema.index({ roadmapId: 1, key: 1 }, { unique: true });
moduleSchema.index({ roadmapId: 1, order: 1 });
moduleSchema.index({ roadmapId: 1, published: 1, archivedAt: 1 });

export type ModuleDocument = InferSchemaType<typeof moduleSchema> & mongoose.Document;
export const ModuleModel = mongoose.model('Module', moduleSchema);
