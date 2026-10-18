import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';
import { DIFFICULTIES, RESOURCE_TYPES, TASK_TYPES } from './constants.js';

const taskResourceSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    url: { type: String, required: true, maxlength: 500 },
    type: { type: String, enum: RESOURCE_TYPES, default: 'suggestion' },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

const quizQuestionSchema = new Schema(
  {
    question: { type: String, required: true, maxlength: 1000 },
    options: { type: [String], validate: [(v: string[]) => v.length >= 2, 'At least two options required'] },
    correctOptionIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, default: '' },
  },
  { _id: false },
);

const exampleSchema = new Schema(
  { input: { type: String, default: '' }, output: { type: String, default: '' }, explanation: { type: String, default: '' } },
  { _id: false },
);

const codingExerciseSchema = new Schema(
  {
    problemStatement: { type: String, default: '' },
    examples: { type: [exampleSchema], default: [] },
    constraints: { type: [String], default: [] },
    hints: { type: [String], default: [] },
    solutionExplanation: { type: String, default: '' },
    starterCode: { type: String, default: '' },
    selfVerified: { type: Boolean, default: true },
  },
  { _id: false, default: null },
);

const taskSchema = new Schema(
  {
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    type: { type: String, enum: TASK_TYPES, required: true, index: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true, index: true },
    estimatedDuration: { type: Number, required: true, min: 1, max: 600 },
    learningObjectives: { type: [String], default: [] },
    instructions: { type: String, default: '', maxlength: 8000 },
    acceptanceCriteria: { type: [String], default: [] },
    resources: { type: [taskResourceSchema], default: [] },
    prerequisites: { type: [{ type: Schema.Types.ObjectId, ref: 'Task' }], default: [] },
    quizQuestions: { type: [quizQuestionSchema], default: [] },
    codingExercise: { type: codingExerciseSchema, default: null },
    published: { type: Boolean, default: true, index: true },
    archivedAt: { type: Date, default: null },
    order: { type: Number, required: true, min: 1 },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

taskSchema.index({ roadmapId: 1, key: 1 }, { unique: true });
taskSchema.index({ topicId: 1, order: 1 });
taskSchema.index({ roadmapId: 1, published: 1, archivedAt: 1 });
taskSchema.index({ roadmapId: 1, moduleId: 1, topicId: 1, published: 1 });

export type TaskDocument = InferSchemaType<typeof taskSchema> & mongoose.Document;
export const Task = mongoose.model('Task', taskSchema);
